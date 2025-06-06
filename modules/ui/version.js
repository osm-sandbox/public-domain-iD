import { prefs } from '../core/preferences';
import { t } from '../core/localizer';
import { svgIcon } from '../svg/icon';
import { uiTooltip } from './tooltip';


// these are module variables so they are preserved through a ui.restart()
var sawVersion = null;
var isNewVersion = false;
var isNewUser = false;


export function uiVersion(context) {

    var currVersion = context.version;
    var matchedVersion = currVersion.match(/\d+\.\d+\.\d+.*/);

    if (sawVersion === null && matchedVersion !== null) {
        if (prefs('sawVersion')) {
            isNewUser = false;
            isNewVersion = prefs('sawVersion') !== currVersion && currVersion.indexOf('-') === -1;
        } else {
            isNewUser = true;
            isNewVersion = true;
        }
        prefs('sawVersion', currVersion);
        sawVersion = currVersion;
    }

    return function(selection) {
        selection
            .append('a')
            .attr('target', '_blank')
            .attr('href', 'https://github.com/osm-sandbox/sandbox-id')
            .text(currVersion);

        /* PDMap - we don't keep a changelog at the moment
        // only show new version indicator to users that have used iD before
        if (isNewVersion && !isNewUser) {
            selection
                .append('a')
                .attr('class', 'badge')
                .attr('target', '_blank')
                .attr('href', `https://github.com/openstreetmap/iD/releases/tag/v${currVersion}`)
                .call(svgIcon('#maki-gift'))
                .call(uiTooltip()
                    .title(() => t.append('version.whats_new', { version: currVersion }))
                    .placement('top')
                    .scrollContainer(context.container().select('.main-footer-wrap'))
                );
        }
        */
    };
}
