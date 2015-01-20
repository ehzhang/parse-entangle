var http = require('http');
var sockjs = require('sockjs');

// DDP Protocol ---------------------------------------------
// Examples:

// ADDED:
// {"msg": "added", "collection": "transactions", "id": "record-1", "fields": {"amount": "50USD", "from": "tom"}}

// CHANGED:
// {"msg": "changed", collection": "transactions", "id": "doc_id", "fields": {"amount": "300USD"}}

// REMOVED:
// {"msg": "removed", "collection": "transactions", "id": "doc_id"}

clients = {}

function broadcast(msg){
  for(key in clients) {
    clients[key].write(msg);
  }
}

var ddp = sockjs.createServer({ sockjs_url: 'http://cdn.jsdelivr.net/sockjs/0.3.4/sockjs.min.js' });
ddp.on('connection', function(conn) {
  clients[conn.id] = conn;
  console.log(conn.id, "joined");

  conn.on('data', function(message) {
    console.log(message);
    broadcast(message);
  });
  conn.on('close', function() {
    delete clients[conn.id];
  });
});

var server = http.createServer(function(req, res){
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello Parse\n');
});

ddp.installHandlers(server, {prefix:'/entangle'});
server.listen(3000, '0.0.0.0');