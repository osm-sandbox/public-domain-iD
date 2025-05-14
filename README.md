# iD Editor for OSM Sandbox

## Hello :wave:

* This is a fork of the [iD editor](https://github.com/openstreetmap/iD) intended for use with [OSM Sandbox](https://github.com/osm-sandbox/)
* Before participating, please read the [Code of Conduct](CODE_OF_CONDUCT.md) and remember to be nice
* Questions or comments? Feel free to [open an issue](https://github.com/osm-sandbox/sandbox-iD/issues)
* This fork is available under the same [ISC License](https://opensource.org/licenses/ISC) used [by iD](https://github.com/openstreetmap/iD#License). See [LICENSE.md](LICENSE.md) for more details

## Sandbox features

Several major changes have been made to this fork in order to facilitate use with OSM Sandbox.

### License configuration

The editor can be configured on launch to show only those data sources (imagery, overlays, etc.) compatible for mapping public domain data (typically [CC0](https://creativecommons.org/public-domain/cc0/)). This can be done by setting `license=cc0` in the URL hash or programmatically by running `context.license('cc0')`. The default license is `odbl`, suitable for editing OpenStreetMap extracts in a sandbox.

### Sandbox login

The OSM Sandbox has a custom login workflow that allows user to login with their OpenStreetMap account instead of registering a separate username and password for each sandbox. This fork has been updated to support this specialized workflow.

### Rebranding

To avoid confusion, references to "OpenStreetMap" in the UI have been replaced with "OSM Sandbox". Information and links specific to OSM have been removed or replaced.
