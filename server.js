const express = require('express');
const app = express();

const crawler = require('./crawler.js');
const indexer = require('./indexer.js');
const server = require('http').Server(app);
var io = require('socket.io')(server);

var socketCount = 0;

server.listen(3000, function()
{
	console.log("Server connected on port 3000");
	//crawler.queue(crawler.getLastCrawled());
	//crawler.queue("http://reddit.com");
	
	crawler.crawl("http://biomecraft.com", 1);
});

var lastCrawled = 0;
var runningCrawler = false;
// Send any changes to the client
function updateSockets()
{
	if(runningCrawler)
	{
		// Send the queue size to the clients
		io.sockets.emit('queueSize', crawler.getQueued().length);
		// Send the next crawled url to the clients
		/*
		crawler.nextCrawl(function(strUrl)
		{
			if(strUrl != "")
			{
				io.sockets.emit('crawl', {url: strUrl});
			} else
			{
				setTimeout(updateSockets, 5);
			}
		});
		*/
	}
	
	setTimeout(updateSockets, 4000);
}

updateSockets();

io.once('connection', function (socket) {
	
	io.sockets.on('connection', function(socket)
	{
		var socketId = socket.id;
		var clientIp = socket.request.connection.remoteAddress;

		console.log(clientIp + " has connected to the server");
		
		socketCount++;
		
		socket.emit('crawl', {url: 'http://reddit.com'});
		if(crawler.isCrawling)
		{
			socket.emit('start');
		}
		
		// Start the crawler
		socket.on('start', function()
		{
			console.log("Client started the crawler");
			runningCrawler = true;
			
			socket.emit('start');
		});
		// Queue a url to crawl
		socket.on('queue', function(url)
		{
			console.log("Client queued " + url);
			crawler.crawl(url);
		});
		// Stop the crawler
		socket.on('stop', function()
		{
			console.log("Client stopped the crawler");
			runningCrawler = false;

			socket.emit('stop');
		});
		socket.on('disconnect', function()
		{
			console.log("disconnected")
			
			socket.removeAllListeners();
			socket.disconnect(true);
		});
	});
});
    
