var http = require('http');
var fs = require('fs');

http.createServer(function(req, res) {
    // fs.writeFile('rabbitholes.json', req.url, (err, data) => {
    //     if (err) throw err;
    //     console.log("File has been written to.")
    // })
    console.log(req.body)
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.write(req.url);
    res.end();
}).listen(8080)