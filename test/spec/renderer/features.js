describe('iD.rendererFeatures', function() {
    var dimensions = [1000, 1000];
    var context, features;

    beforeEach(function() {
        context = iD.coreContext().assetPath('../dist/').init();
        d3.select(document.createElement('div'))
            .attr('class', 'main-map')
            .call(context.map());
        context.map().zoom(16);
        features = iD.rendererFeatures(context);
    });

    describe('#keys', function() {
        it('returns feature keys', function() {
            var keys = features.keys();
            expect(keys).to.include(
                'points', 'traffic_roads', 'service_roads', 'paths',
                'buildings', 'landuse', 'boundaries', 'water', 'rail',
                'power', 'past_future', 'others'
            );
        });
    });

    describe('#disable', function() {
        it('disables features', function() {
            features.disable('water');
            expect(features.disabled()).to.include('water');
            expect(features.enabled()).to.not.include('water');
        });
    });

    describe('#enable', function() {
        it('enables features', function() {
            features.disable('water');
            features.enable('water');
            expect(features.disabled()).to.not.include('water');
            expect(features.enabled()).to.include('water');
        });
    });

    describe('#toggle', function() {
        it('toggles features', function() {
            features.toggle('water');
            expect(features.disabled()).to.include('water');
            expect(features.enabled()).to.not.include('water');

            features.toggle('water');
            expect(features.disabled()).to.not.include('water');
            expect(features.enabled()).to.include('water');
        });
    });

    describe('#gatherStats', function() {
        it('counts features', function() {
            var graph = iD.coreGraph([
                iD.osmNode({id: 'point_bar', tags: {amenity: 'bar'}, version: 1}),
                iD.osmNode({id: 'point_dock', tags: {waterway: 'dock'}, version: 1}),
                iD.osmNode({id: 'point_rail_station', tags: {railway: 'station'}, version: 1}),
                iD.osmNode({id: 'point_generator', tags: {power: 'generator'}, version: 1}),
                iD.osmNode({id: 'point_old_rail_station', tags: {'disused:railway': 'station'}, version: 1}),
                iD.osmWay({id: 'motorway', tags: {highway: 'motorway'}, version: 1}),
                iD.osmWay({id: 'building_yes', tags: {area: 'yes', amenity: 'school', building: 'yes'}, version: 1}),
                iD.osmWay({id: 'boundary', tags: {boundary: 'administrative'}, version: 1}),
                iD.osmWay({id: 'fence', tags: {barrier: 'fence'}, version: 1})
            ]);
            var all = Object.values(graph.base().entities);
            var stats;

            features.gatherStats(all, graph, dimensions);
            stats = features.stats();

            expect(stats.boundaries).to.eql(1);
            expect(stats.buildings).to.eql(1);
            expect(stats.landuse).to.eql(0);
            expect(stats.traffic_roads).to.eql(1);
            expect(stats.service_roads).to.eql(0);
            expect(stats.others).to.eql(1);
            expect(stats.past_future).to.eql(1);
            expect(stats.paths).to.eql(0);
            expect(stats.points).to.eql(5);
            expect(stats.power).to.eql(1);
            expect(stats.rail).to.eql(1);
            expect(stats.water).to.eql(1);
        });
    });

    describe('matching', function() {
        var graph = iD.coreGraph([
            // Points
            iD.osmNode({id: 'point_bar', tags: {amenity: 'bar'}, version: 1}),
            iD.osmNode({id: 'point_dock', tags: {waterway: 'dock'}, version: 1}),
            iD.osmNode({id: 'point_rail_station', tags: {railway: 'station'}, version: 1}),
            iD.osmNode({id: 'point_generator', tags: {power: 'generator'}, version: 1}),
            iD.osmNode({id: 'point_old_rail_station', tags: {'disused:railway': 'station'}, version: 1}),

            // Traffic Roads
            iD.osmWay({id: 'motorway', tags: {highway: 'motorway'}, version: 1}),
            iD.osmWay({id: 'motorway_link', tags: {highway: 'motorway_link'}, version: 1}),
            iD.osmWay({id: 'trunk', tags: {highway: 'trunk'}, version: 1}),
            iD.osmWay({id: 'trunk_link', tags: {highway: 'trunk_link'}, version: 1}),
            iD.osmWay({id: 'primary', tags: {highway: 'primary'}, version: 1}),
            iD.osmWay({id: 'primary_link', tags: {highway: 'primary_link'}, version: 1}),
            iD.osmWay({id: 'secondary', tags: {highway: 'secondary'}, version: 1}),
            iD.osmWay({id: 'secondary_link', tags: {highway: 'secondary_link'}, version: 1}),
            iD.osmWay({id: 'tertiary', tags: {highway: 'tertiary'}, version: 1}),
            iD.osmWay({id: 'tertiary_link', tags: {highway: 'tertiary_link'}, version: 1}),
            iD.osmWay({id: 'residential', tags: {highway: 'residential'}, version: 1}),
            iD.osmWay({id: 'unclassified', tags: {highway: 'unclassified'}, version: 1}),
            iD.osmWay({id: 'living_street', tags: {highway: 'living_street'}, version: 1}),

            // Service Roads
            iD.osmWay({id: 'service', tags: {highway: 'service'}, version: 1}),
            iD.osmWay({id: 'road', tags: {highway: 'road'}, version: 1}),
            iD.osmWay({id: 'track', tags: {highway: 'track'}, version: 1}),

            // Paths
            iD.osmWay({id: 'path', tags: {highway: 'path'}, version: 1}),
            iD.osmWay({id: 'footway', tags: {highway: 'footway'}, version: 1}),
            iD.osmWay({id: 'cycleway', tags: {highway: 'cycleway'}, version: 1}),
            iD.osmWay({id: 'bridleway', tags: {highway: 'bridleway'}, version: 1}),
            iD.osmWay({id: 'steps', tags: {highway: 'steps'}, version: 1}),
            iD.osmWay({id: 'pedestrian', tags: {highway: 'pedestrian'}, version: 1}),

            // Buildings
            iD.osmWay({id: 'building_yes', tags: {area: 'yes', amenity: 'school', building: 'yes'}, version: 1}),
            iD.osmWay({id: 'building_no', tags: {area: 'yes', amenity: 'school', building: 'no'}, version: 1}),
            iD.osmWay({id: 'building_part', tags: { 'building:part': 'yes'}, version: 1}),
            iD.osmWay({id: 'garage1', tags: {area: 'yes', amenity: 'parking', parking: 'multi-storey'}, version: 1}),
            iD.osmWay({id: 'garage2', tags: {area: 'yes', amenity: 'parking', parking: 'sheds'}, version: 1}),
            iD.osmWay({id: 'garage3', tags: {area: 'yes', amenity: 'parking', parking: 'carports'}, version: 1}),
            iD.osmWay({id: 'garage4', tags: {area: 'yes', amenity: 'parking', parking: 'garage_boxes'}, version: 1}),

            // Indoor
            iD.osmWay({id: 'room', tags: {area: 'yes', indoor: 'room'}, version: 1}),
            iD.osmWay({id: 'indoor_area', tags: {area: 'yes', indoor: 'area'}, version: 1}),
            iD.osmWay({id: 'indoor_bar', tags: {area: 'yes', indoor: 'room', amenity: 'bar'}, version: 1}),
            iD.osmWay({id: 'corridor', tags: {highway: 'corridor', indoor: 'yes'}, version: 1}),

            // Pistes
            iD.osmWay({id: 'downhill_piste', tags: {'piste:type': 'downhill'}, version: 1}),
            iD.osmWay({id: 'piste_track_combo', tags: {'piste:type': 'alpine', highway: 'track'}, version: 1}),

            // Aerialways
            iD.osmWay({id: 'gondola', tags: {aerialway: 'gondola'}, version: 1}),
            iD.osmWay({id: 'zip_line', tags: {aerialway: 'zip_line'}, version: 1}),
            iD.osmWay({id: 'aerialway_platform', tags: {public_transport: 'platform', aerialway: 'yes'}, version: 1}),
            iD.osmWay({id: 'old_aerialway_station', tags: {area: 'yes', aerialway: 'station'}, version: 1}),

            // Landuse
            iD.osmWay({id: 'forest', tags: {area: 'yes', landuse: 'forest'}, version: 1}),
            iD.osmWay({id: 'scrub', tags: {area: 'yes', natural: 'scrub'}, version: 1}),
            iD.osmWay({id: 'industrial', tags: {area: 'yes', landuse: 'industrial'}, version: 1}),
            iD.osmWay({id: 'parkinglot', tags: {area: 'yes', amenity: 'parking', parking: 'surface'}, version: 1}),
            iD.osmWay({id: 'park', tags: {area: 'yes', leisure: 'park', parking: 'surface'}, version: 1}),

            // Landuse Multipolygon
            iD.osmWay({id: 'outer', version: 1}),
            iD.osmWay({id: 'inner1', version: 1}),
            iD.osmWay({id: 'inner2', tags: {barrier: 'fence'}, version: 1}),
            iD.osmWay({id: 'inner3', tags: {highway: 'residential'}, version: 1}),
            iD.osmRelation({id: 'retail', tags: {landuse: 'retail', type: 'multipolygon'},
                    members: [
                        {id: 'outer', role: 'outer', type: 'way'},
                        {id: 'inner1', role: 'inner', type: 'way'},
                        {id: 'inner2', role: 'inner', type: 'way'},
                        {id: 'inner3', role: 'inner', type: 'way'}
                    ],
                    version: 1
                }),

            // Boundaries
            iD.osmWay({id: 'boundary', tags: {boundary: 'administrative'}, version: 1}),
            iD.osmWay({id: 'boundary_road', tags: {boundary: 'administrative', highway: 'primary'}, version: 1}),

            iD.osmWay({id: 'boundary_member', version: 1}),
            iD.osmWay({id: 'boundary_member2', version: 1}),

            // Boundary relations
            iD.osmRelation({id: 'boundary_relation', tags: {type: 'boundary', boundary: 'administrative'},
                    members: [
                        {id: 'boundary_member'},
                    ],
                    version: 1
                }),
            iD.osmRelation({id: 'boundary_relation2', tags: {type: 'boundary', boundary: 'administrative'},
                    members: [
                        // ways can be members of multiple boundary relations
                        {id: 'boundary_member'},
                        {id: 'boundary_member2'}
                    ],
                    version: 1
                }),

            // Water
            iD.osmWay({id: 'water', tags: {area: 'yes', natural: 'water'}, version: 1}),
            iD.osmWay({id: 'coastline', tags: {natural: 'coastline'}, version: 1}),
            iD.osmWay({id: 'bay', tags: {area: 'yes', natural: 'bay'}, version: 1}),
            iD.osmWay({id: 'pond', tags: {area: 'yes', landuse: 'pond'}, version: 1}),
            iD.osmWay({id: 'basin', tags: {area: 'yes', landuse: 'basin'}, version: 1}),
            iD.osmWay({id: 'reservoir', tags: {area: 'yes', landuse: 'reservoir'}, version: 1}),
            iD.osmWay({id: 'salt_pond', tags: {area: 'yes', landuse: 'salt_pond'}, version: 1}),
            iD.osmWay({id: 'river', tags: {waterway: 'river'}, version: 1}),

            // Rail
            iD.osmWay({id: 'railway', tags: {railway: 'rail'}, version: 1}),
            iD.osmWay({id: 'rail_landuse', tags: {area: 'yes', landuse: 'railway'}, version: 1}),
            iD.osmWay({id: 'rail_disused', tags: {railway: 'disused'}, version: 1}),
            iD.osmWay({id: 'rail_streetcar', tags: {railway: 'tram', highway: 'residential'}, version: 1}),
            iD.osmWay({id: 'rail_trail', tags: {railway: 'disused', highway: 'cycleway'}, version: 1}),

            // Power
            iD.osmWay({id: 'power_line', tags: {power: 'line'}, version: 1}),

            // Past/Future
            iD.osmWay({id: 'motorway_construction', tags: {highway: 'construction', construction: 'motorway'}, version: 1}),
            iD.osmWay({id: 'cycleway_proposed', tags: {highway: 'proposed', proposed: 'cycleway'}, version: 1}),
            iD.osmWay({id: 'landuse_construction', tags: {area: 'yes', landuse: 'construction'}, version: 1}),

            // Others
            iD.osmWay({id: 'fence', tags: {barrier: 'fence'}, version: 1}),
            iD.osmWay({id: 'pipeline', tags: {man_made: 'pipeline'}, version: 1}),

            // Site relation
            iD.osmRelation({id: 'site', tags: {type: 'site'},
                    members: [
                        {id: 'fence', role: 'perimeter'},
                        {id: 'building_yes'}
                    ],
                    version: 1
                })

        ]);
        var all = Object.values(graph.base().entities);


        function doMatch(rule, ids) {
            ids.forEach(function(id) {
                var entity = graph.entity(id);
                var geometry = entity.geometry(graph);
                expect(features.getMatches(entity, graph, geometry), 'doMatch: ' + id)
                    .to.have.property(rule);
            });
        }

        function dontMatch(rule, ids) {
            ids.forEach(function(id) {
                var entity = graph.entity(id);
                var geometry = entity.geometry(graph);
                expect(features.getMatches(entity, graph, geometry), 'dontMatch: ' + id)
                    .not.to.have.property(rule);
            });
        }


        it('matches points', function () {
            features.gatherStats(all, graph, dimensions);

            doMatch('points', [
                'point_bar', 'point_dock', 'point_rail_station',
                'point_generator', 'point_old_rail_station'
            ]);

            dontMatch('points', [
                'motorway', 'service', 'path', 'building_yes',
                'forest', 'boundary', 'boundary_member', 'water', 'railway', 'power_line',
                'motorway_construction', 'fence'
            ]);
        });


        it('matches traffic roads', function () {
            features.gatherStats(all, graph, dimensions);

            doMatch('traffic_roads', [
                'motorway', 'motorway_link', 'trunk', 'trunk_link',
                'primary', 'primary_link', 'secondary', 'secondary_link',
                'tertiary', 'tertiary_link', 'residential', 'living_street',
                'unclassified', 'boundary_road', 'inner3'
            ]);

            dontMatch('traffic_roads', [
                'point_bar', 'service', 'road', 'track', 'path', 'building_yes',
                'forest', 'boundary', 'boundary_member', 'water', 'railway', 'power_line',
                'motorway_construction', 'fence'
            ]);
        });


        it('matches service roads', function () {
            features.gatherStats(all, graph, dimensions);

            doMatch('service_roads', [
                'service', 'road', 'track', 'piste_track_combo'
            ]);

            dontMatch('service_roads', [
                'point_bar', 'motorway', 'unclassified', 'living_street',
                'path', 'building_yes', 'forest', 'boundary', 'boundary_member', 'water',
                'railway', 'power_line', 'motorway_construction', 'fence'
            ]);
        });


        it('matches paths', function () {
            features.gatherStats(all, graph, dimensions);

            doMatch('paths', [
                'path', 'footway', 'cycleway', 'bridleway',
                'steps', 'pedestrian'
            ]);

            dontMatch('paths', [
                'point_bar', 'motorway', 'service', 'building_yes',
                'forest', 'boundary', 'boundary_member', 'water', 'railway', 'power_line',
                'motorway_construction', 'fence', 'corridor'
            ]);
        });


        it('matches buildings', function () {
            features.gatherStats(all, graph, dimensions);

            doMatch('buildings', [
                'building_yes',
                'garage1', 'garage2', 'garage3', 'garage4'
            ]);

            dontMatch('buildings', [
                'building_no', 'point_bar', 'motorway', 'service', 'path',
                'forest', 'boundary', 'boundary_member', 'water', 'railway', 'power_line',
                'motorway_construction', 'fence'
            ]);
        });


        it('matches building_parts', function () {
            features.gatherStats(all, graph, dimensions);

            doMatch('building_parts', [
                'building_part'
            ]);

            dontMatch('building_parts', [
                'building_yes',
                'garage1', 'garage2', 'garage3', 'garage4',
                'building_no', 'point_bar', 'motorway', 'service', 'path',
                'forest', 'boundary', 'boundary_member', 'water', 'railway', 'power_line',
                'motorway_construction', 'fence'
            ]);
        });


        it('matches indoor', function () {
            features.gatherStats(all, graph, dimensions);

            doMatch('indoor', [
                'room', 'indoor_area', 'indoor_bar', 'corridor'
            ]);

            dontMatch('indoor', [
                'downhill_piste', 'piste_track_combo',
                'building_part', 'garage1', 'garage2', 'garage3', 'garage4',
                'building_no', 'point_bar', 'motorway', 'service', 'path', 'building_yes',
                'boundary', 'boundary_member', 'water', 'railway', 'power_line',
                'motorway_construction', 'fence',
                'inner3', 'forest', 'scrub', 'industrial', 'parkinglot', 'building_no',
                'rail_landuse', 'landuse_construction', 'retail',
                'outer', 'inner1', 'inner2'
            ]);
        });


        it('matches pistes', function () {
            features.gatherStats(all, graph, dimensions);

            doMatch('pistes', [
                'downhill_piste', 'piste_track_combo'
            ]);

            dontMatch('pistes', [
                'room', 'indoor_area', 'indoor_bar', 'corridor',
                'building_part', 'garage1', 'garage2', 'garage3', 'garage4',
                'building_no', 'point_bar', 'motorway', 'service', 'path', 'building_yes',
                'boundary', 'boundary_member', 'water', 'railway', 'power_line',
                'motorway_construction', 'fence',
                'inner3', 'forest', 'scrub', 'industrial', 'parkinglot', 'building_no',
                'rail_landuse', 'landuse_construction', 'retail',
                'outer', 'inner1', 'inner2'
            ]);
        });


        it('matches aerialways', function () {
            features.gatherStats(all, graph, dimensions);

            doMatch('aerialways', [
                'gondola', 'zip_line'
            ]);

            dontMatch('aerialways', [
                'aerialway_platform', 'old_aerialway_station',

                'downhill_piste', 'piste_track_combo',
                'room', 'indoor_area', 'indoor_bar', 'corridor',
                'building_part', 'garage1', 'garage2', 'garage3', 'garage4',
                'building_no', 'point_bar', 'motorway', 'service', 'path', 'building_yes',
                'boundary', 'boundary_member', 'water', 'railway', 'power_line',
                'motorway_construction', 'fence',
                'inner3', 'forest', 'scrub', 'industrial', 'parkinglot', 'building_no',
                'rail_landuse', 'landuse_construction', 'retail',
                'outer', 'inner1', 'inner2'
            ]);
        });


        it('matches landuse', function () {
            features.gatherStats(all, graph, dimensions);

            doMatch('landuse', [
                'forest', 'scrub', 'industrial', 'parkinglot', 'building_no',
                'rail_landuse', 'landuse_construction', 'retail',
                'outer', 'inner1', 'inner2'  // non-interesting members of landuse multipolygon
            ]);

            dontMatch('landuse', [
                'point_bar', 'motorway', 'service', 'path', 'building_yes',
                'boundary', 'boundary_member', 'water', 'railway', 'power_line',
                'motorway_construction', 'fence',
                'inner3'   // member of landuse multipolygon, but tagged as highway
            ]);
        });


        it('matches boundaries', function () {
            features.gatherStats(all, graph, dimensions);

            doMatch('boundaries', [
                'boundary',
                // match ways that are part of boundary relations - #5601
                'boundary_member', 'boundary_member2',
                // relations
                'boundary_relation', 'boundary_relation2'
            ]);

            dontMatch('boundaries', [
                'boundary_road',   // because boundary also used as highway - #4973
                'point_bar', 'motorway', 'service', 'path', 'building_yes',
                'forest', 'water', 'railway', 'power_line',
                'motorway_construction', 'fence'
            ]);
        });


        it('matches water', function () {
            features.gatherStats(all, graph, dimensions);

            doMatch('water', [
                'point_dock', 'water', 'coastline', 'bay', 'pond',
                'basin', 'reservoir', 'salt_pond', 'river'
            ]);

            dontMatch('water', [
                'point_bar', 'motorway', 'service', 'path', 'building_yes',
                'forest', 'boundary', 'boundary_member', 'railway', 'power_line',
                'motorway_construction', 'fence'
            ]);
        });


        it('matches rail', function () {
            features.gatherStats(all, graph, dimensions);

            doMatch('rail', [
                'point_rail_station', 'railway', 'rail_landuse', 'rail_disused'
            ]);

            dontMatch('rail', [
                'rail_streetcar', 'rail_trail',  // because rail also used as highway
                'point_old_rail_station',
                'point_bar', 'motorway', 'service', 'path', 'building_yes',
                'forest', 'boundary', 'boundary_member', 'water', 'power_line',
                'motorway_construction', 'fence'
            ]);
        });


        it('matches power', function () {
            features.gatherStats(all, graph, dimensions);

            doMatch('power', [
                'point_generator', 'power_line'
            ]);

            dontMatch('power', [
                'point_bar', 'motorway', 'service', 'path', 'building_yes',
                'forest', 'boundary', 'boundary_member', 'water', 'railway',
                'motorway_construction', 'fence'
            ]);
        });


        it('matches past/future', function () {
            features.gatherStats(all, graph, dimensions);

            doMatch('past_future', [
                'point_old_rail_station', 'rail_disused',
                'motorway_construction', 'cycleway_proposed', 'landuse_construction'
            ]);

            dontMatch('past_future', [
                'rail_trail',  // because rail also used as highway
                'point_bar', 'motorway', 'service', 'path', 'building_yes',
                'forest', 'boundary', 'boundary_member', 'water', 'railway', 'power_line', 'fence'
            ]);
        });


        it('matches others', function () {
            features.gatherStats(all, graph, dimensions);

            doMatch('others', [
                'fence', 'pipeline'
            ]);

            dontMatch('others', [
                'point_bar', 'motorway', 'service', 'path', 'building_yes',
                'forest', 'boundary', 'boundary_member', 'water', 'railway', 'power_line',
                'motorway_construction', 'retail', 'outer', 'inner1', 'inner2', 'inner3'
            ]);
        });
    });


    describe('hiding', function() {
        it('hides child vertices on a hidden way', function() {
            var a = iD.osmNode({id: 'a', version: 1});
            var b = iD.osmNode({id: 'b', version: 1});
            var w = iD.osmWay({id: 'w', nodes: [a.id, b.id], tags: {highway: 'path'}, version: 1});
            var graph = iD.coreGraph([a, b, w]);
            var geometry = a.geometry(graph);
            var all = Object.values(graph.base().entities);

            features.disable('paths');
            features.gatherStats(all, graph, dimensions);

            expect(features.isHiddenChild(a, graph, geometry)).to.be.true;
            expect(features.isHiddenChild(b, graph, geometry)).to.be.true;
            expect(features.isHidden(a, graph, geometry)).to.be.true;
            expect(features.isHidden(b, graph, geometry)).to.be.true;
        });

        it('hides uninteresting (e.g. untagged or "other") member ways on a hidden multipolygon relation', function() {
            var outer = iD.osmWay({id: 'outer', tags: {}, version: 1});
            var inner1 = iD.osmWay({id: 'inner1', tags: {barrier: 'fence'}, version: 1});
            var inner2 = iD.osmWay({id: 'inner2', version: 1});
            var inner3 = iD.osmWay({id: 'inner3', tags: {highway: 'residential'}, version: 1});
            var r = iD.osmRelation({
                id: 'r',
                tags: {type: 'multipolygon', natural: 'wood'},
                members: [
                    {id: outer.id, role: 'outer', type: 'way'},
                    {id: inner1.id, role: 'inner', type: 'way'},
                    {id: inner2.id, role: 'inner', type: 'way'},
                    {id: inner3.id, role: 'inner', type: 'way'}
                ],
                version: 1
            });
            var graph = iD.coreGraph([outer, inner1, inner2, inner3, r]);
            var all = Object.values(graph.base().entities);

            features.disable('landuse');
            features.gatherStats(all, graph, dimensions);

            expect(features.isHidden(outer, graph, outer.geometry(graph))).to.be.true;     // #2548
            expect(features.isHidden(inner1, graph, inner1.geometry(graph))).to.be.true;   // #2548
            expect(features.isHidden(inner2, graph, inner2.geometry(graph))).to.be.true;   // #2548
            expect(features.isHidden(inner3, graph, inner3.geometry(graph))).to.be.false;  // #2887
        });

        it('hides only versioned entities', function() {
            var a = iD.osmNode({id: 'a', version: 1});
            var b = iD.osmNode({id: 'b'});
            var graph = iD.coreGraph([a, b]);
            var ageo = a.geometry(graph);
            var bgeo = b.geometry(graph);
            var all = Object.values(graph.base().entities);

            features.disable('points');
            features.gatherStats(all, graph, dimensions);

            expect(features.isHidden(a, graph, ageo)).to.be.true;
            expect(features.isHidden(b, graph, bgeo)).to.be.false;
        });

        it('#forceVisible', function() {
            var a = iD.osmNode({id: 'a', version: 1});
            var graph = iD.coreGraph([a]);
            var ageo = a.geometry(graph);
            var all = Object.values(graph.base().entities);

            features.disable('points');
            features.gatherStats(all, graph, dimensions);
            features.forceVisible(['a']);

            expect(features.isHidden(a, graph, ageo)).to.be.false;
        });

        it('auto-hides features', function() {
            var graph = iD.coreGraph([]);
            var maxPoints = 200;
            var all, hidden, autoHidden, i, msg;

            for (i = 0; i < maxPoints; i++) {
                graph.rebase([iD.osmNode({version: 1})], [graph]);
            }

            all = Object.values(graph.base().entities);
            features.gatherStats(all, graph, dimensions);
            hidden = features.hidden();
            autoHidden = features.autoHidden();
            msg = i + ' points';

            expect(hidden, msg).to.not.include('points');
            expect(autoHidden, msg).to.not.include('points');

            graph.rebase([iD.osmNode({version: 1})], [graph]);

            all = Object.values(graph.base().entities);
            features.gatherStats(all, graph, dimensions);
            hidden = features.hidden();
            autoHidden = features.autoHidden();
            msg = ++i + ' points';

            expect(hidden, msg).to.include('points');
            expect(autoHidden, msg).to.include('points');
        });

        it('doubles auto-hide threshold when doubling viewport size', function() {
            var graph = iD.coreGraph([]);
            var maxPoints = 400;
            var dimensions = [2000, 1000];
            var all, hidden, autoHidden, i, msg;

            for (i = 0; i < maxPoints; i++) {
                graph.rebase([iD.osmNode({version: 1})], [graph]);
            }

            all = Object.values(graph.base().entities);
            features.gatherStats(all, graph, dimensions);
            hidden = features.hidden();
            autoHidden = features.autoHidden();
            msg = i + ' points';

            expect(hidden, msg).to.not.include('points');
            expect(autoHidden, msg).to.not.include('points');

            graph.rebase([iD.osmNode({version: 1})], [graph]);

            all = Object.values(graph.base().entities);
            features.gatherStats(all, graph, dimensions);
            hidden = features.hidden();
            autoHidden = features.autoHidden();
            msg = ++i + ' points';

            expect(hidden, msg).to.include('points');
            expect(autoHidden, msg).to.include('points');
        });
    });

});
