const fs = require('fs');

const dir = './dist/locales';

fs.readdir(dir, (err, files) => {
  if (err) throw err;
  files.forEach(file => {
    const path = dir + '/' + file;
    fs.readFile(path, (err, data) => {
      if (err) throw err;
      var out = new String(data)
        .replace(/OpenStreetMap/g, 'PublicDomainMap')
        .replace(/\(https:\/\/www.openstreetmap.org\/\)/g, '(https://www.publicdomainmap.org/)')
        .replace(/https:\/\/www.openstreetmap.org\/copyright/g, 'https://www.publicdomainmap.org/license')
        .replace(/\(https:\/\/github.com\/openstreetmap\/iD\)/g, '(https://github.com/publicdomainmap/editor)');

      fs.writeFile(path, out, (err) => {
        if (err) throw err;
      });
    });
  })
});
