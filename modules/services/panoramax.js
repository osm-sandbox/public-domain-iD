import { dispatch as d3_dispatch } from 'd3-dispatch';

import Protobuf from 'pbf';
import RBush from 'rbush';
import { VectorTile } from '@mapbox/vector-tile';

import { utilRebind, utilTiler, utilQsString, utilStringQs, utilUniqueDomId} from '../util';
import { geoExtent, geoScaleToZoom } from '../geo';
import { t, localizer } from '../core/localizer';
import pannellumPhotoFrame from './pannellum_photo';
import planePhotoFrame from './plane_photo';
import { services } from './';


const apiUrl = 'https://api.panoramax.xyz/';
const tileUrl = apiUrl + 'api/map/{z}/{x}/{y}.mvt';
const imageDataUrl = apiUrl + 'api/collections/{collectionId}/items/{itemId}';
const userIdUrl = apiUrl + 'api/users/search?q={username}';
const usernameURL = apiUrl + 'api/users/{userId}';
const viewerUrl = apiUrl;

const highDefinition = 'hd';
const standardDefinition = 'sd';

const pictureLayer = 'pictures';
const sequenceLayer = 'sequences';

const minZoom = 10;
const imageMinZoom = 15;
const lineMinZoom = 10;
const dispatch = d3_dispatch('loadedImages', 'loadedLines', 'viewerChanged');

let _cache;
let _loadViewerPromise;
let _definition = standardDefinition;
let _isHD = false;

let _planeFrame;
let _pannellumFrame;
let _currentFrame;

let _currentScene = {
    currentImage : null,
    nextImage : null,
    prevImage : null
};

let _activeImage;
let _isViewerOpen = false;


// Partition viewport into higher zoom tiles
function partitionViewport(projection) {
    const z = geoScaleToZoom(projection.scale());
    const z2 = (Math.ceil(z * 2) / 2) + 2.5;   // round to next 0.5 and add 2.5
    const tiler = utilTiler().zoomExtent([z2, z2]);

    return tiler.getTiles(projection)
        .map(function(tile) { return tile.extent; });
}

/**
 * Return no more than `limit` results per partition.
 * @param {number} limit Number of maximum objects to return
 * @param {*} projection Current projection
 * @param {*} rtree The cache
 * @returns Data found
 */
function searchLimited(limit, projection, rtree) {
    limit = limit || 5;

    return partitionViewport(projection)
        .reduce(function(result, extent) {
            let found = rtree.search(extent.bbox());
            const spacing = Math.max(1, Math.floor(found.length / limit));
            found = found
                .filter((d, idx) => idx % spacing === 0 ||
                                    d.data.id === _activeImage?.id)
                .sort((a, b) => {
                    if (a.data.id === _activeImage?.id) return -1;
                    if (b.data.id === _activeImage?.id) return  1;
                    return 0;
                })
                .slice(0, limit)
                .map(d => d.data);

            return (found.length ? result.concat(found) : result);
        }, []);
}

/**
 * Load all data for the specified type from Panoramax vector tiles
 * @param {string} which Either 'images' or 'lines'
 * @param {string} url Tile endpoint
 * @param {number} maxZoom Maximum zoom out
 * @param {*} projection Current projection
 * @param {number} zoom current zoom
 */
function loadTiles(which, url, maxZoom, projection, zoom) {
    const tiler = utilTiler().zoomExtent([minZoom, maxZoom]).skipNullIsland(true);
    const tiles = tiler.getTiles(projection);

    tiles.forEach(function(tile) {
        loadTile(which, url, tile, zoom);
    });
}

/**
 * Load all data for the specified type from one vector tile
 * @param {*} which Either 'images' or 'lines'
 * @param {*} url Tile endpoint
 * @param {*} tile Current tile
 * @param {*} zoom Current zoom
 */
function loadTile(which, url, tile, zoom) {
    const cache = _cache.requests;
    const tileId = `${tile.id}-${which}`;
    if (cache.loaded[tileId] || cache.inflight[tileId]) return;
    const controller = new AbortController();
    cache.inflight[tileId] = controller;
    const requestUrl = url.replace('{x}', tile.xyz[0])
        .replace('{y}', tile.xyz[1])
        .replace('{z}', tile.xyz[2]);

    fetch(requestUrl, { signal: controller.signal })
        .then(function(response) {
            if (!response.ok) {
                throw new Error(response.status + ' ' + response.statusText);
            }
            cache.loaded[tileId] = true;
            delete cache.inflight[tileId];
            return response.arrayBuffer();
        })
        .then(function(data) {
            if (data.byteLength === 0) {
                throw new Error('No Data');
            }

            loadTileDataToCache(data, tile, zoom);

            if (which === 'images') {
                dispatch.call('loadedImages');
            } else {
                dispatch.call('loadedLines');
            }
        })
        .catch(function (e) {
            if (e.message === 'No Data') {
                cache.loaded[tileId] = true;
            } else {
                console.error(e); // eslint-disable-line no-console
            }
        });
}

/**
 * Fetches all data for the specified tile and adds them to cache
 * @param {*} data Tile data
 * @param {*} tile Current tile
 * @param {*} zoom Current zoom
 */
function loadTileDataToCache(data, tile, zoom) {
    const vectorTile = new VectorTile(new Protobuf(data));

    let features,
        cache,
        layer,
        i,
        feature,
        loc,
        d;

    if (vectorTile.layers.hasOwnProperty(pictureLayer)) {
        features = [];
        cache = _cache.images;
        layer = vectorTile.layers[pictureLayer];

        for (i = 0; i < layer.length; i++) {
            feature = layer.feature(i).toGeoJSON(tile.xyz[0], tile.xyz[1], tile.xyz[2]);
            loc = feature.geometry.coordinates;

            d = {
                service: 'photo',
                loc: loc,
                capture_time: feature.properties.ts,
                capture_time_parsed: new Date(feature.properties.ts),
                id: feature.properties.id,
                account_id: feature.properties.account_id,
                sequence_id: feature.properties.sequences.split('\"')[1],
                heading: parseInt(feature.properties.heading, 10),
                image_path: '',
                isPano: feature.properties.type === 'equirectangular',
                model: feature.properties.model,
            };
            cache.forImageId[d.id] = d;
            features.push({
                minX: loc[0], minY: loc[1], maxX: loc[0], maxY: loc[1], data: d
            });
        }
        if (cache.rtree) {
            cache.rtree.load(features);
        }
    }

    if (vectorTile.layers.hasOwnProperty(sequenceLayer)) {

        cache = _cache.sequences;

        if (zoom >= lineMinZoom && zoom < imageMinZoom) cache = _cache.mockSequences;

        layer = vectorTile.layers[sequenceLayer];

        for (i = 0; i < layer.length; i++) {
            feature = layer.feature(i).toGeoJSON(tile.xyz[0], tile.xyz[1], tile.xyz[2]);
            if (cache.lineString[feature.properties.id]) {
                cache.lineString[feature.properties.id].push(feature);
            } else {
                cache.lineString[feature.properties.id] = [feature];
            }
        }
    }
}

/**
 * Fetches the username from Panoramax
 * @param {string} user_id
 * @returns the username
 */
async function getUsername(user_id){
    const requestUrl = usernameURL.replace('{userId}', user_id);

    const response = await fetch(requestUrl, { method: 'GET' });
    if (!response.ok) {
        throw new Error(response.status + ' ' + response.statusText);
    }
    const data = await response.json();
    return data.name;
}

export default {
    init: function() {
        if (!_cache) {
            this.reset();
        }

        this.event = utilRebind(this, dispatch, 'on');
    },

    reset: function() {
        if (_cache) {
            Object.values(_cache.requests.inflight).forEach(function(request) { request.abort(); });
        }

        _cache = {
            images: { rtree: new RBush(), forImageId: {} },
            sequences: { rtree: new RBush(), lineString: {} },
            mockSequences: { rtree: new RBush(), lineString: {} },
            requests: { loaded: {}, inflight: {} }
        };
    },

    /**
     * Get visible images from cache
     * @param {*} projection Current Projection
     * @returns images data for the current projection
     */
    images: function(projection) {
        const limit = 5;
        return searchLimited(limit, projection, _cache.images.rtree);
    },

    /**
     * Get a specific image from cache
     * @param {*} imageKey the image id
     * @returns
     */
    cachedImage: function(imageKey) {
        return _cache.images.forImageId[imageKey];
    },

    /**
     * Fetches images data for the visible area
     * @param {*} projection Current Projection
     */
    loadImages: function(projection) {
        loadTiles('images', tileUrl, imageMinZoom, projection);
    },

    /**
     * Fetches sequences data for the visible area
     * @param {*} projection Current Projection
     */
    loadLines: function(projection, zoom) {
        loadTiles('line', tileUrl, lineMinZoom, projection, zoom);
    },

    /**
     * Fetches all possible userIDs from Panoramax
     * @param {string} usernames one or multiple usernames
     * @returns userIDs
     */
    getUserIds: async function(usernames) {
        const requestUrls = usernames.map(username =>
            userIdUrl.replace('{username}', username));

        const responses = await Promise.all(requestUrls.map(requestUrl =>
            fetch(requestUrl, { method: 'GET' })));
        if (responses.some(response => !response.ok)) {
            const response = responses.find(response => !response.ok);
            throw new Error(response.status + ' ' + response.statusText);
        }
        const data = await Promise.all(responses.map(response => response.json()));
        // in panoramax, a username can have multiple ids, when the same name is
        // used on different servers
        return data.flatMap((d, i) => d.features.filter(f => f.name === usernames[i]).map(f => f.id));
    },

    /**
     * Get visible sequences from cache
     * @param {*} projection Current Projection
     * @param {number} zoom Current zoom (if zoom < `lineMinZoom` less accurate lines will be drawn)
     * @returns sequences data for the current projection
     */
    sequences: function(projection, zoom) {
        const viewport = projection.clipExtent();
        const min = [viewport[0][0], viewport[1][1]];
        const max = [viewport[1][0], viewport[0][1]];
        const bbox = geoExtent(projection.invert(min), projection.invert(max)).bbox();
        const sequenceIds = {};
        let lineStrings = [];

        if (zoom >= imageMinZoom){
            _cache.images.rtree.search(bbox).forEach(function(d) {
                    if (d.data.sequence_id) {
                        sequenceIds[d.data.sequence_id] = true;
                    }
                });
                Object.keys(sequenceIds).forEach(function(sequenceId) {
                    if (_cache.sequences.lineString[sequenceId]) {
                        lineStrings = lineStrings.concat(_cache.sequences.lineString[sequenceId]);
                    }
                });
                return lineStrings;
        }
        if (zoom >= lineMinZoom){
            Object.keys(_cache.mockSequences.lineString).forEach(function(sequenceId) {
                lineStrings = lineStrings.concat(_cache.mockSequences.lineString[sequenceId]);
            });
        }
        return lineStrings;
    },

    /**
     * Updates the data for the currently visible image
     * @param {*} image Image data
     */
    setActiveImage: function(image) {
        if (image && image.id && image.sequence_id) {
            _activeImage = {
                id: image.id,
                sequence_id: image.sequence_id,
                loc: image.loc
            };
        } else {
            _activeImage = null;
        }
    },

    getActiveImage: function(){
        return _activeImage;
    },

    /**
     * Update the currently highlighted sequence and selected bubble
     * @param {*} context Current HTML context
     * @param {*} [hovered] The hovered bubble image
     */
    setStyles: function(context, hovered) {
        const hoveredImageId =  hovered && hovered.id;
        const hoveredSequenceId = hovered && hovered.sequence_id;
        const selectedSequenceId = _activeImage && _activeImage.sequence_id;
        const selectedImageId = _activeImage && _activeImage.id;

        const markers = context.container().selectAll('.layer-panoramax .viewfield-group');
        const sequences = context.container().selectAll('.layer-panoramax .sequence');

        markers
            .classed('highlighted', function(d) { return d.sequence_id === selectedSequenceId || d.id === hoveredImageId; })
            .classed('hovered', function(d) { return d.id === hoveredImageId; })
            .classed('currentView', function(d) { return d.id === selectedImageId; });

        sequences
            .classed('highlighted', function(d) { return d.properties.id === hoveredSequenceId; })
            .classed('currentView', function(d) { return d.properties.id === selectedSequenceId; });

        // update viewfields if needed
        context.container().selectAll('.layer-panoramax .viewfield-group .viewfield')
            .attr('d', viewfieldPath);

        function viewfieldPath() {
            let d = this.parentNode.__data__;
            if (d.isPano && d.id !== selectedImageId) {
                return 'M 8,13 m -10,0 a 10,10 0 1,0 20,0 a 10,10 0 1,0 -20,0';
            } else {
                return 'M 6,9 C 8,8.4 8,8.4 10,9 L 16,-2 C 12,-5 4,-5 0,-2 z';
            }
        }
        return this;
    },

    // Get viewer status
    isViewerOpen: function() {
        return _isViewerOpen;
    },

    /**
     * Updates the URL to save the current shown image
     * @param {*} imageKey
     */
    updateUrlImage: function(imageKey) {
        const hash = utilStringQs(window.location.hash);
        if (imageKey) {
            hash.photo = 'panoramax/' + imageKey;
        } else {
            delete hash.photo;
        }
        window.history.replaceState(null, '', '#' + utilQsString(hash, true));
    },

    /**
     * Loads the selected image in the frame
     * @param {*} context Current HTML context
     * @param {*} id of the selected image
     * @returns
     */
    selectImage: function (context, id) {
        let that = this;

        let d = that.cachedImage(id);
        that.setActiveImage(d);
        that.updateUrlImage(d.id);

        const viewerLink = `${viewerUrl}#pic=${d.id}&focus=pic`;

        let viewer = context.container()
            .select('.photoviewer');

        if (!viewer.empty()) viewer.datum(d);

        this.setStyles(context, null);

        if (!d) return this;

        let wrap = context.container()
            .select('.photoviewer .panoramax-wrapper');

        let attribution = wrap.selectAll('.photo-attribution').text('');

        let line1 = attribution
            .append('div')
            .attr('class', 'attribution-row');

        const hdDomId = utilUniqueDomId('panoramax-hd');

        let label = line1
            .append('label')
            .attr('for', hdDomId)
            .attr('class', 'panoramax-hd');

        label
            .append('input')
            .attr('type', 'checkbox')
            .attr('id', hdDomId)
            .property('checked', _isHD)
            .on('click', (d3_event) => {
                d3_event.stopPropagation();
                _isHD = !_isHD;
                _definition = _isHD ? highDefinition : standardDefinition;
                that.selectImage(context, d.id)
                .showViewer(context);
            });

        label
            .append('span')
            .call(t.append('panoramax.hd'));

        if (d.capture_time) {
            attribution
                .append('span')
                .attr('class', 'captured_at')
                .text(localeDateString(d.capture_time));

            attribution
                .append('span')
                .text('|');
        }

        attribution
            .append('a')
            .attr('class', 'report-photo')
            .attr('href', 'mailto:signalement.ign@panoramax.fr')
            .call(t.append('panoramax.report'));

        attribution
            .append('span')
            .text('|');

        attribution
            .append('a')
            .attr('class', 'image-link')
            .attr('target', '_blank')
            .attr('href', viewerLink)
            .text('panoramax.xyz');

        this.getImageData(d.sequence_id, d.id).then(function(data){
            _currentScene = {
                currentImage: null,
                nextImage: null,
                prevImage: null
            };
            _currentScene.currentImage = data.assets[_definition];
            const nextIndex = data.links.findIndex(x => x.rel === 'next');
            const prevIndex = data.links.findIndex(x => x.rel === 'prev');

            if (nextIndex !== -1){
                _currentScene.nextImage = data.links[nextIndex];
            }
            if (prevIndex !== -1){
                _currentScene.prevImage = data.links[prevIndex];
            }

            d.image_path = _currentScene.currentImage.href;

            wrap
                .selectAll('button.back')
                .classed('hide', _currentScene.prevImage === null);
            wrap
                .selectAll('button.forward')
                .classed('hide', _currentScene.nextImage === null);

            _currentFrame = d.isPano ? _pannellumFrame : _planeFrame;

            _currentFrame
                .showPhotoFrame(wrap)
                .selectPhoto(d, true);
        });

        function localeDateString(s) {
            if (!s) return null;
            var options = { day: 'numeric', month: 'short', year: 'numeric' };
            var d = new Date(s);
            if (isNaN(d.getTime())) return null;
            return d.toLocaleDateString(localizer.localeCode(), options);
        }

        if (d.account_id) {
            attribution
                .append('span')
                .text('|');

            let line2 = attribution
                .append('span')
                .attr('class', 'attribution-row');

            getUsername(d.account_id).then(function(username){
                line2
                    .append('span')
                    .attr('class', 'captured_by')
                    .text('@' + username);
            });
        }

        return this;
    },

    photoFrame: function() {
        return _currentFrame;
    },

    /**
     * Fetches the data for a specific image
     * @param {*} collection_id
     * @param {*} image_id
     * @returns The fetched image data
     */
    getImageData: async function(collection_id, image_id){
        const requestUrl = imageDataUrl.replace('{collectionId}', collection_id)
            .replace('{itemId}', image_id);

        const response = await fetch(requestUrl, { method: 'GET' });
        if (!response.ok) {
            throw new Error(response.status + ' ' + response.statusText);
        }
        const data = await response.json();
        return data;
    },

    ensureViewerLoaded: function(context) {

        let that = this;

        let imgWrap = context.container()
            .select('#ideditor-viewer-panoramax-simple > img');

        if (!imgWrap.empty()) {
            imgWrap.remove();
        }

        if (_loadViewerPromise) return _loadViewerPromise;

        let wrap = context.container()
            .select('.photoviewer')
            .selectAll('.panoramax-wrapper')
            .data([0]);

        let wrapEnter = wrap.enter()
            .append('div')
            .attr('class', 'photo-wrapper panoramax-wrapper')
            .classed('hide', true)
            .on('dblclick.zoom', null);

        wrapEnter
            .append('div')
            .attr('class', 'photo-attribution fillD');

        const controlsEnter = wrapEnter
            .append('div')
            .attr('class', 'photo-controls-wrap')
            .append('div')
            .attr('class', 'photo-controls-panoramax');

        controlsEnter
            .append('button')
            .classed('back', true)
            .on('click.back', step(-1))
            .text('◄');

        controlsEnter
            .append('button')
            .classed('forward', true)
            .on('click.forward', step(1))
            .text('►');

        // Register viewer resize handler
        _loadViewerPromise = Promise.all([
            pannellumPhotoFrame.init(context, wrapEnter),
            planePhotoFrame.init(context, wrapEnter)
          ]).then(([pannellumPhotoFrame, planePhotoFrame]) => {
            _pannellumFrame = pannellumPhotoFrame;
            _pannellumFrame.event.on('viewerChanged', () => dispatch.call('viewerChanged'));
            _planeFrame = planePhotoFrame;
            _planeFrame.event.on('viewerChanged', () => dispatch.call('viewerChanged'));
          });

        /**
         * Loads the next image in the sequence
         * @param {number} stepBy '-1' if backwards or '1' if forward
         * @returns
         */
        function step(stepBy) {
            return function () {
                if (!_currentScene.currentImage) return;

                let nextId;
                if (stepBy === 1) nextId = _currentScene.nextImage.id;
                else nextId = _currentScene.prevImage.id;

                if (!nextId) return;

                const nextImage = _cache.images.forImageId[nextId];

                if (nextImage){
                    context.map().centerEase(nextImage.loc);
                    that.selectImage(context, nextImage.id);
                }
            };
        }

        return _loadViewerPromise;
    },

    /**
     * Shows the current viewer if hidden
     * @param {*} context
     */
    showViewer: function (context) {
        const wrap = context.container().select('.photoviewer');
        const isHidden = wrap.selectAll('.photo-wrapper.panoramax-wrapper.hide').size();
        if (isHidden) {
            for (const service of Object.values(services)) {
                if (service === this) continue;
                if (typeof service.hideViewer === 'function') {
                    service.hideViewer(context);
                }
            }
            wrap.classed('hide', false)
                .selectAll('.photo-wrapper.panoramax-wrapper')
                .classed('hide', false);
        }

        _isViewerOpen = true;
        return this;
    },

    /**
     * Hides the current viewer if shown, resets the active image and sequence
     * @param {*} context
     */
    hideViewer: function (context) {
        let viewer = context.container().select('.photoviewer');
        if (!viewer.empty()) viewer.datum(null);
        this.updateUrlImage(null);
        viewer
            .classed('hide', true)
            .selectAll('.photo-wrapper')
            .classed('hide', true);
        context.container().selectAll('.viewfield-group, .sequence, .icon-sign')
            .classed('currentView', false);

        this.setActiveImage(null);
        _isViewerOpen = false;

        return this.setStyles(context, null);
    },

    cache: function() {
        return _cache;
    }
};
