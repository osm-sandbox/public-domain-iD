import { dispatch as d3_dispatch } from 'd3-dispatch';
import { json as d3_json } from 'd3-fetch';
import { zoom as d3_zoom, zoomIdentity as d3_zoomIdentity } from 'd3-zoom';

import RBush from 'rbush';

import { localizer } from '../core/localizer';
import { geoExtent, geoScaleToZoom } from '../geo';
import { utilQsString, utilRebind, utilSetTransform, utilStringQs, utilTiler } from '../util';
import { services } from './';


var apibase = 'https://kartaview.org';
var maxResults = 1000;
var tileZoom = 14;
var tiler = utilTiler().zoomExtent([tileZoom, tileZoom]).skipNullIsland(true);
var dispatch = d3_dispatch('loadedImages');
var imgZoom = d3_zoom()
    .extent([[0, 0], [320, 240]])
    .translateExtent([[0, 0], [320, 240]])
    .scaleExtent([1, 15]);
var _oscCache;
var _oscSelectedImage;
var _loadViewerPromise;


function abortRequest(controller) {
    controller.abort();
}


function maxPageAtZoom(z) {
    if (z < 15)   return 2;
    if (z === 15) return 5;
    if (z === 16) return 10;
    if (z === 17) return 20;
    if (z === 18) return 40;
    if (z > 18)   return 80;
}


function loadTiles(which, url, projection) {
    var currZoom = Math.floor(geoScaleToZoom(projection.scale()));
    var tiles = tiler.getTiles(projection);

    // abort inflight requests that are no longer needed
    var cache = _oscCache[which];
    Object.keys(cache.inflight).forEach(function(k) {
        var wanted = tiles.find(function(tile) { return k.indexOf(tile.id + ',') === 0; });
        if (!wanted) {
            abortRequest(cache.inflight[k]);
            delete cache.inflight[k];
        }
    });

    tiles.forEach(function(tile) {
        loadNextTilePage(which, currZoom, url, tile);
    });
}


function loadNextTilePage(which, currZoom, url, tile) {
    var cache = _oscCache[which];
    var bbox = tile.extent.bbox();
    var maxPages = maxPageAtZoom(currZoom);
    var nextPage = cache.nextPage[tile.id] || 1;
    var params = utilQsString({
        ipp: maxResults,
        page: nextPage,
        // client_id: clientId,
        bbTopLeft: [bbox.maxY, bbox.minX].join(','),
        bbBottomRight: [bbox.minY, bbox.maxX].join(',')
    }, true);

    if (nextPage > maxPages) return;

    var id = tile.id + ',' + String(nextPage);
    if (cache.loaded[id] || cache.inflight[id]) return;

    var controller = new AbortController();
    cache.inflight[id] = controller;

    var options = {
        method: 'POST',
        signal: controller.signal,
        body: params,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    };

    d3_json(url, options)
        .then(function(data) {
            cache.loaded[id] = true;
            delete cache.inflight[id];
            if (!data || !data.currentPageItems || !data.currentPageItems.length) {
                throw new Error('No Data');
            }

            var features = data.currentPageItems.map(function(item) {
                var loc = [+item.lng, +item.lat];
                var d;

                if (which === 'images') {
                    d = {
                        service: 'photo',
                        loc: loc,
                        key: item.id,
                        ca: +item.heading,
                        captured_at: (item.shot_date || item.date_added),
                        captured_by: item.username,
                        imagePath: item.name,
                        sequence_id: item.sequence_id,
                        sequence_index: +item.sequence_index
                    };

                    // cache sequence info
                    var seq = _oscCache.sequences[d.sequence_id];
                    if (!seq) {
                        seq = { rotation: 0, images: [] };
                        _oscCache.sequences[d.sequence_id] = seq;
                    }
                    seq.images[d.sequence_index] = d;
                    _oscCache.images.forImageKey[d.key] = d;     // cache imageKey -> image
                }

                return {
                    minX: loc[0], minY: loc[1], maxX: loc[0], maxY: loc[1], data: d
                };
            });

            cache.rtree.load(features);

            if (data.currentPageItems.length === maxResults) {  // more pages to load
                cache.nextPage[tile.id] = nextPage + 1;
                loadNextTilePage(which, currZoom, url, tile);
            } else {
                cache.nextPage[tile.id] = Infinity;     // no more pages to load
            }

            if (which === 'images') {
                dispatch.call('loadedImages');
            }
        })
        .catch(function() {
            cache.loaded[id] = true;
            delete cache.inflight[id];
        });
}


// partition viewport into higher zoom tiles
function partitionViewport(projection) {
    var z = geoScaleToZoom(projection.scale());
    var z2 = (Math.ceil(z * 2) / 2) + 2.5;   // round to next 0.5 and add 2.5
    var tiler = utilTiler().zoomExtent([z2, z2]);

    return tiler.getTiles(projection)
        .map(function(tile) { return tile.extent; });
}


// no more than `limit` results per partition.
function searchLimited(limit, projection, rtree) {
    limit = limit || 5;

    return partitionViewport(projection)
        .reduce(function(result, extent) {
            var found = rtree.search(extent.bbox())
                .slice(0, limit)
                .map(function(d) { return d.data; });

            return (found.length ? result.concat(found) : result);
        }, []);
}


export default {

    init: function() {
        if (!_oscCache) {
            this.reset();
        }

        this.event = utilRebind(this, dispatch, 'on');
    },

    reset: function() {
        if (_oscCache) {
            Object.values(_oscCache.images.inflight).forEach(abortRequest);
        }

        _oscCache = {
            images: { inflight: {}, loaded: {}, nextPage: {}, rtree: new RBush(), forImageKey: {} },
            sequences: {}
        };
    },


    images: function(projection) {
        var limit = 5;
        return searchLimited(limit, projection, _oscCache.images.rtree);
    },


    sequences: function(projection) {
        var viewport = projection.clipExtent();
        var min = [viewport[0][0], viewport[1][1]];
        var max = [viewport[1][0], viewport[0][1]];
        var bbox = geoExtent(projection.invert(min), projection.invert(max)).bbox();
        var sequenceKeys = {};

        // all sequences for images in viewport
        _oscCache.images.rtree.search(bbox)
            .forEach(function(d) { sequenceKeys[d.data.sequence_id] = true; });

        // make linestrings from those sequences
        var lineStrings = [];
        Object.keys(sequenceKeys)
            .forEach(function(sequenceKey) {
                var seq = _oscCache.sequences[sequenceKey];
                var images = seq && seq.images;

                if (images) {
                    lineStrings.push({
                        type: 'LineString',
                        coordinates: images.map(function (d) { return d.loc; }).filter(Boolean),
                        properties: {
                            captured_at: images[0] ? images[0].captured_at: null,
                            captured_by: images[0] ? images[0].captured_by: null,
                            key: sequenceKey
                        }
                    });
                }
            });
        return lineStrings;
    },


    cachedImage: function(imageKey) {
        return _oscCache.images.forImageKey[imageKey];
    },


    loadImages: function(projection) {
        var url = apibase + '/1.0/list/nearby-photos/';
        loadTiles('images', url, projection);
    },


    ensureViewerLoaded: function(context) {

        if (_loadViewerPromise) return _loadViewerPromise;

        // add kartaview-wrapper
        var wrap = context.container().select('.photoviewer').selectAll('.kartaview-wrapper')
            .data([0]);

        var that = this;

        var wrapEnter = wrap.enter()
            .append('div')
            .attr('class', 'photo-wrapper kartaview-wrapper')
            .classed('hide', true)
            .call(imgZoom.on('zoom', zoomPan))
            .on('dblclick.zoom', null);

        wrapEnter
            .append('div')
            .attr('class', 'photo-attribution fillD');

        var controlsEnter = wrapEnter
            .append('div')
            .attr('class', 'photo-controls-wrap')
            .append('div')
            .attr('class', 'photo-controls');

        controlsEnter
            .append('button')
            .on('click.back', step(-1))
            .text('◄');

        controlsEnter
            .append('button')
            .on('click.rotate-ccw', rotate(-90))
            .text('⤿');

        controlsEnter
            .append('button')
            .on('click.rotate-cw', rotate(90))
            .text('⤾');

        controlsEnter
            .append('button')
            .on('click.forward', step(1))
            .text('►');

        wrapEnter
            .append('div')
            .attr('class', 'kartaview-image-wrap');


        // Register viewer resize handler
        context.ui().photoviewer.on('resize.kartaview', function(dimensions) {
            imgZoom
                .extent([[0, 0], dimensions])
                .translateExtent([[0, 0], dimensions]);
        });


        function zoomPan(d3_event) {
            var t = d3_event.transform;
            context.container().select('.photoviewer .kartaview-image-wrap')
                .call(utilSetTransform, t.x, t.y, t.k);
        }


        function rotate(deg) {
            return function() {
                if (!_oscSelectedImage) return;
                var sequenceKey = _oscSelectedImage.sequence_id;
                var sequence = _oscCache.sequences[sequenceKey];
                if (!sequence) return;

                var r = sequence.rotation || 0;
                r += deg;

                if (r > 180) r -= 360;
                if (r < -180) r += 360;
                sequence.rotation = r;

                var wrap = context.container().select('.photoviewer .kartaview-wrapper');

                wrap
                    .transition()
                    .duration(100)
                    .call(imgZoom.transform, d3_zoomIdentity);

                wrap.selectAll('.kartaview-image')
                    .transition()
                    .duration(100)
                    .style('transform', 'rotate(' + r + 'deg)');
            };
        }

        function step(stepBy) {
            return function() {
                if (!_oscSelectedImage) return;
                var sequenceKey = _oscSelectedImage.sequence_id;
                var sequence = _oscCache.sequences[sequenceKey];
                if (!sequence) return;

                var nextIndex = _oscSelectedImage.sequence_index + stepBy;
                var nextImage = sequence.images[nextIndex];
                if (!nextImage) return;

                context.map().centerEase(nextImage.loc);

                that
                    .selectImage(context, nextImage.key);
            };
        }

        // don't need any async loading so resolve immediately
        _loadViewerPromise = Promise.resolve();

        return _loadViewerPromise;
    },


    showViewer: function(context) {
        const wrap = context.container().select('.photoviewer');
        const isHidden = wrap.selectAll('.photo-wrapper.kartaview-wrapper.hide').size();

        if (isHidden) {
            for (const service of Object.values(services)) {
                if (service === this) continue;
                if (typeof service.hideViewer === 'function') {
                    service.hideViewer(context);
                }
            }
            wrap.classed('hide', false)
                .selectAll('.photo-wrapper.kartaview-wrapper')
                .classed('hide', false);
        }

        return this;
    },


    hideViewer: function(context) {
        _oscSelectedImage = null;

        this.updateUrlImage(null);

        var viewer = context.container().select('.photoviewer');
        if (!viewer.empty()) viewer.datum(null);

        viewer
            .classed('hide', true)
            .selectAll('.photo-wrapper')
            .classed('hide', true);

        context.container().selectAll('.viewfield-group, .sequence, .icon-sign')
            .classed('currentView', false);

        return this.setStyles(context, null, true);
    },


    selectImage: function(context, imageKey) {

        var d = this.cachedImage(imageKey);

        _oscSelectedImage = d;

        this.updateUrlImage(imageKey);

        var viewer = context.container().select('.photoviewer');
        if (!viewer.empty()) viewer.datum(d);

        this.setStyles(context, null, true);

        context.container().selectAll('.icon-sign')
            .classed('currentView', false);

        if (!d) return this;

        var wrap = context.container().select('.photoviewer .kartaview-wrapper');
        var imageWrap = wrap.selectAll('.kartaview-image-wrap');
        var attribution = wrap.selectAll('.photo-attribution').text('');

        wrap
            .transition()
            .duration(100)
            .call(imgZoom.transform, d3_zoomIdentity);

        imageWrap
            .selectAll('.kartaview-image')
            .remove();

        if (d) {
            var sequence = _oscCache.sequences[d.sequence_id];
            var r = (sequence && sequence.rotation) || 0;

            imageWrap
                .append('img')
                .attr('class', 'kartaview-image')
                .attr('src', (apibase + '/' + d.imagePath).replace(/^https:\/\/kartaview\.org\/storage(\d+)\//, 'https://storage$1.openstreetcam.org/'))
                .style('transform', 'rotate(' + r + 'deg)');

            if (d.captured_by) {
                attribution
                    .append('a')
                    .attr('class', 'captured_by')
                    .attr('target', '_blank')
                    .attr('href', 'https://kartaview.org/user/' + encodeURIComponent(d.captured_by))
                    .text('@' + d.captured_by);

                attribution
                    .append('span')
                    .text('|');
            }

            if (d.captured_at) {
                attribution
                    .append('span')
                    .attr('class', 'captured_at')
                    .text(localeDateString(d.captured_at));

                attribution
                    .append('span')
                    .text('|');
            }

            attribution
                .append('a')
                .attr('class', 'image-link')
                .attr('target', '_blank')
                .attr('href', 'https://kartaview.org/details/' + d.sequence_id + '/' + d.sequence_index)
                .text('kartaview.org');
        }

        return this;


        function localeDateString(s) {
            if (!s) return null;
            var options = { day: 'numeric', month: 'short', year: 'numeric' };
            var d = new Date(s);
            if (isNaN(d.getTime())) return null;
            return d.toLocaleDateString(localizer.localeCode(), options);
        }
    },


    getSelectedImage: function() {
        return _oscSelectedImage;
    },


    getSequenceKeyForImage: function(d) {
        return d && d.sequence_id;
    },


    // Updates the currently highlighted sequence and selected bubble.
    // Reset is only necessary when interacting with the viewport because
    // this implicitly changes the currently selected bubble/sequence
    setStyles: function(context, hovered, reset) {
        if (reset) {  // reset all layers
            context.container().selectAll('.viewfield-group')
                .classed('highlighted', false)
                .classed('hovered', false)
                .classed('currentView', false);

            context.container().selectAll('.sequence')
                .classed('highlighted', false)
                .classed('currentView', false);
        }

        var hoveredImageId = hovered && hovered.key;
        var hoveredSequenceId = this.getSequenceKeyForImage(hovered);

        var viewer = context.container().select('.photoviewer');
        var selected = viewer.empty() ? undefined : viewer.datum();
        var selectedImageId = selected && selected.key;
        var selectedSequenceId = this.getSequenceKeyForImage(selected);

        // highlight sibling viewfields on either the selected or the hovered sequences
        context.container().selectAll('.layer-kartaview .viewfield-group')
            .classed('highlighted', function(d) { return d.sequence_id === selectedSequenceId || d.id === hoveredImageId; })
            .classed('hovered', function(d) { return d.key === hoveredImageId; })
            .classed('currentView', function(d) { return d.key === selectedImageId; });

        context.container().selectAll('.layer-kartaview .sequence')
            .classed('highlighted', function(d) { return d.properties.key === hoveredSequenceId; })
            .classed('currentView', function(d) { return d.properties.key === selectedSequenceId; });

        // update viewfields if needed
        context.container().selectAll('.layer-kartaview .viewfield-group .viewfield')
            .attr('d', viewfieldPath);

        function viewfieldPath() {
            var d = this.parentNode.__data__;
            if (d.pano && d.key !== selectedImageId) {
                return 'M 8,13 m -10,0 a 10,10 0 1,0 20,0 a 10,10 0 1,0 -20,0';
            } else {
                return 'M 6,9 C 8,8.4 8,8.4 10,9 L 16,-2 C 12,-5 4,-5 0,-2 z';
            }
        }

        return this;
    },


    updateUrlImage: function(imageKey) {
        const hash = utilStringQs(window.location.hash);
        if (imageKey) {
            hash.photo = 'kartaview/' + imageKey;
        } else {
            delete hash.photo;
        }
        window.history.replaceState(null, '', '#' + utilQsString(hash, true));
    },


    cache: function() {
        return _oscCache;
    }

};
