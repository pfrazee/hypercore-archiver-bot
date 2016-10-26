#!/usr/bin/env node

var archiver = require('hypercore-archiver')
var irc = require('irc')
var mkdirp = require('mkdirp')
var minimist = require('minimist')
var disc = require('discovery-channel')({hash: false})
var net = require('net')
var pump = require('pump')

var argv = minimist(process.argv.slice(2), {
  alias: {
    channel: 'c',
    cwd: 'd',
    server: 's',
    name: 'n',
    port: 'p'
  },
  default: {
    port: 3282,
    cwd: 'hypercore-archiver',
    name: 'archive-bot',
    server: 'irc.freenode.net'
  }
})

mkdirp.sync(argv.cwd)

var ar = archiver(argv.cwd)
var server = net.createServer(function (socket) {
  pump(socket, ar.replicate(), socket)
})

server.listen(argv.port, function () {
  ar.list().on('data', function (key) {
    setTimeout(join, Math.floor(Math.random() * 30 * 1000))

    function join () {
      console.log('Joining', key.toString('hex'))
      disc.join(ar.discoveryKey(key), server.address().port)
    }
  })

  console.log('Listening on port', server.address().port)
})

var client = new irc.Client(argv.server, argv.name, {
  channels: [argv.channel]
})

client.on('message', function (from, to, message) {
  var op = parse(message)
  if (!op) return
  switch (op.command) {
    case 'add': return add(new Buffer(op.key, 'hex'))
    case 'rm':
    case 'remove': return remove(new Buffer(op.key, 'hex'))
  }
})

function add (key) {
  console.log('Adding', key.toString('hex'))
  client.say(argv.channel, 'Adding ' +  key.toString('hex'))
  disc.join(ar.discoveryKey(key), server.address().port)
  ar.add(key)
}

function remove (key) {
  console.log('Removing', key.toString('hex'))
  client.say(argv.channel, 'Removing ' +  key.toString('hex'))
  disc.leave(ar.discoveryKey(key), server.address().port)
  ar.remove(key)
}

function parse (message) {
  message = message.trim()
  if (message.indexOf(argv.name + ':') !== 0) return null
  message = message.split(':').pop().trim()
  if (message.indexOf(' ') === -1) return parse('add ' + message)
  var parts = message.split(' ')
  if (!/^[0-9a-f]{64}$/.test(parts[1])) return null
  return {
    command: parts[0],
    key: parts[1]
  }
}
