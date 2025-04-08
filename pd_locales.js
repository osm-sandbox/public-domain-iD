const fs = require('fs');

const dir = './dist/locales';

fs.readdir(dir, (err, files) => {
  if (err) throw err;
  files.forEach(file => {
    const path = dir + '/' + file;
    fs.readFile(path, (err, data) => {
      if (err) throw err;
      var out = new String(data)
        .replace(/\(https:\/\/github.com\/openstreetmap\/iD\)/g, '(https://github.com/osm-sandbox/sandbox-iD)')
        .replace(/OpenStreetMap/g, 'OSM Sandbox')
        .replace(/https:\/\/www.openstreetmap.org\/copyright/g, 'https://www.publicdomainmap.org/license')
        .replace(/\(https:\/\/www.openstreetmap.org\/\)/g, '(https://www.publicdomainmap.org/)')
        // FIXME - these two aren't multi-language
        .replace(/on openstreetmap.org/g, 'on osmsandbox.us')
        .replace(/History on osm.org/g, 'History on osmsandbox.us');

      fs.writeFile(path, out, (err) => {
        if (err) throw err;
      });
    });
  })
});
