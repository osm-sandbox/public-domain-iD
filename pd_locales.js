const fs = require('fs');

const dir = './dist/locales';

fs.readdir(dir, (err, files) => {
  if (err) throw err;
  files.forEach(file => {
    const path = dir + '/' + file;
    fs.readFile(path, (err, data) => {
      if (err) throw err;
      fs.writeFile(path, new String(data).replace(/OpenStreetMap/g, 'PublicDomainMap'), (err) => {
        if (err) throw err;
      });
    });
  })
});
