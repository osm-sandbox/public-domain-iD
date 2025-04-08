/* eslint-disable no-undef */

// cdns for external data packages
const presetsCdnUrl = ENV__ID_PRESETS_CDN_URL
  || 'https://cdn.jsdelivr.net/npm/@openstreetmap/id-tagging-schema@{presets_version}/';
const ociCdnUrl = ENV__ID_OCI_CDN_URL
  || 'https://cdn.jsdelivr.net/npm/osm-community-index@{version}/';
const wmfSitematrixCdnUrl = ENV__ID_WMF_SITEMATRIX_CDN_URL
  || 'https://cdn.jsdelivr.net/npm/wmf-sitematrix@{version}/';
const nsiCdnUrl = ENV__ID_NSI_CDN_URL
  || 'https://cdn.jsdelivr.net/npm/name-suggestion-index@{version}/';

// api urls and settings
const defaultOsmApiConnections = {
  "live": {
    url: 'https://api.ncem.boxes.osmsandbox.us',
    client_id: '7yDot3Plq2g0cbapXcTEpSKldYWDk-BTyeUNl6YtC0I',
    client_secret: '7doG1Bj-xIKe7Atd5ch_n65veU-3I2nQSyvCTdmoPMY'
  }/*,
  "dev": {
    url: 'https://master.api.dev.publicdomainmap.org',
    client_id: '',
    client_secret: ''
  }*/
};
const osmApiConnections = [];
if (ENV__ID_API_CONNECTION_URL !== null &&
    ENV__ID_API_CONNECTION_CLIENT_ID !== null) {
  // user specified API Oauth2 connection details
  // see https://wiki.openstreetmap.org/wiki/OAuth#OAuth_2.0_2
  osmApiConnections.push({
    url: ENV__ID_API_CONNECTION_URL,
    apiUrl: ENV__ID_API_CONNECTION_API_URL || ENV__ID_API_CONNECTION_URL,
    client_id: ENV__ID_API_CONNECTION_CLIENT_ID
  });
} else if (ENV__ID_API_CONNECTION !== null &&
  defaultOsmApiConnections[ENV__ID_API_CONNECTION] !== undefined) {
  // if environment variable ID_API_CONNECTION is either "live" or "dev":
  // only allow to connect to the respective OSM server
    osmApiConnections.push(defaultOsmApiConnections[ENV__ID_API_CONNECTION]);
} else {
  // offer both "live" and "dev" servers by default
  osmApiConnections.push(defaultOsmApiConnections.live);
  //osmApiConnections.push(defaultOsmApiConnections.dev);
}

// auxiliary OSM services
const taginfoApiUrl = ENV__ID_TAGINFO_API_URL
  || 'https://taginfo.openstreetmap.org/api/4/';
const nominatimApiUrl = ENV__ID_NOMINATIM_API_URL
  || 'https://nominatim.openstreetmap.org/';

// support/donation message on upload success screen
// const showDonationMessage = ENV__ID_SHOW_DONATION_MESSAGE !== 'false';

// PDMap: hardcode false
const showDonationMessage = false;

export {
  presetsCdnUrl,
  ociCdnUrl,
  wmfSitematrixCdnUrl,
  nsiCdnUrl,
  osmApiConnections,
  taginfoApiUrl,
  nominatimApiUrl,
  showDonationMessage
};
