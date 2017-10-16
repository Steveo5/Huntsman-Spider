const cheerio = require('cheerio');
const request = require('request');
const fs = require('fs');
var mysql = require('mysql'); 
var assert = require('assert');

// Create the mysql connection
var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "crawler"
});

var crawling = true;
var queuedUrls = [];

// Actually connect to the initiated connection
con.connect(function(err) {
  if (err) throw err;
  console.log("MySQL connection was successful");
  //Query to create the urls table
   var sql = "CREATE TABLE IF NOT EXISTS urls";
   sql += " (urlID int NOT NULL AUTO_INCREMENT";
   sql += ", url VARCHAR(255)";
   sql += ", title VARCHAR(100)";
   sql += ", description VARCHAR(255)"
   sql += ", keywords VARCHAR(255)"
   sql += ", PRIMARY KEY(urlID))";
   // Begin the actual query
  con.query(sql, function (err, result) {
    if (err) throw err;
    console.log("Created the url's table");
  });
  
	var createMetadataTable = "CREATE TABLE IF NOT EXISTS meta";
	createMetadataTable += " (dataName VARCHAR(255)";
	createMetadataTable += ", data VARCHAR(255))";

	con.query(createMetadataTable, function (err, result) {
	if (err) throw err;
	console.log("Created the metadata table");
	});
	
	/*
	var addDefaultOptions = "INSERT INTO meta (dataName, data) VALUES('lastUrl', 'http://reddit.com')";
	con.query(addDefaultOptions, function (err, result) {
	if (err) throw err;
		console.log("Set the default options in the metadata table");
	});
	*/
});

// Check if the crawler is crawling
exports.isCrawling = function()
{
	return crawling;
}


// Get the last crawled url from the database
exports.getLastCrawled = function(callback)
{
	var query = "SELECT * FROM meta WHERE dataName LIKE 'lastUrl'";
	con.query(query, function(err, result)
	{
		if(err) throw err;
		return callback(result[0].data);
	});
}

/**
* Adds a link into the database
**/
function addCrawl(title, callback)
{
	var query = "INSERT INTO urls(url) VALUES('" + title + "')";
	
	con.query(query, function(err, result)
	{
		if(err) throw err;
		
		return callback();
	});
}

/*
MongoClient.connect(url, function(err, db) {
  if (err) throw err;
  console.log("Database created!");
  db.close();
});
*/

// Check if the crawler has visited a url before
function hasCrawled(url, callback)
{
	// Get the crawled urls already
	exports.getCrawled(function(crawled)
	{
		var found = false;
		for(i in crawled)
		{
			//TODO - implement better searching
			if(crawled[i].url == url) found = true;
		}
		
		return callback(found);
	});
}

// Creates an iterator object
function makeIterator(array) {
    var nextIndex = 0;
    
    return {
       next: function() {
           return nextIndex < array.length ?
               {value: array[nextIndex++], done: false} :
               {done: true};
       }
    };
}

exports.crawl = function(website, depth)
{
	console.log("Website url: " + website)
	console.log("Current depth: " + depth);
	console.log("Action: crawl/scrape");
	
	request(website, function(error, response, body) {
	  if(error) {
		console.log("Error: " + error);
		
	  } else
	  {
		  //console.log("Status code: " + response.statusCode);
		//Only use websites that return a ping
		console.log("rq");
		if(response.statusCode == 200)
		{
		  
		  var loadedBody = cheerio.load(body);
		  var $ = loadedBody;
		  
		  var links = getLinks(website, loadedBody);
		  
		  var iterator = 0
		  
		  while(iterator < links.length)
		  {
			var next = links[iterator];
			if(!isQueued(next))
			{
				// Queue all the urls in the page
				exports.queue(next, function()
				{
					exports.crawl(next, depth + 1);
				});
			}
			iterator++;
		  }
		  /*
		  for(l in links)
		  {
			var title = links[l];
			
			console.log("links in page " + title);
			
			if(!hasCrawled(title))
			{
				console.log("was it found? yes");
			}
			
			/*
			hasCrawled(title, function(found)
			{
				console.log(title + " found = " + found);
				if(!found)
				{
					// Queue the url to be crawled
					exports.queue(function()
					{
						console.log("=========================================================");
						//exports.crawl(title, depth + 1);
						addCrawl(title);
					});
				}
			});
			*/
		  //}
		  
		  // Hold the website meta
		  var meta = getMeta(loadedBody);
		  var websiteTitle = getTitle(loadedBody);
		  var description = meta['description'];
		  var keywords = meta['keywords'];
		  var author = meta['author'];
		 
		  // Count the urls on the page
		  var urlCount = links.length;
		  
		  if(websiteTitle != null && websiteTitle != "")
		  {
			  console.log("Title: " + websiteTitle);
		  }
		  
		  if(description != null && description != "")
		  {
			  console.log("Description: " + description);
		  }
		  
		  if(author != null && author != "")
		  {
			  console.log("Author: " + author);
		  }
		  
		  console.log("Urls found: " + urlCount);
		  
		}
	  }
	});
}

/**
* Gets the meta tags for the specified body.
* Tags are returned as an array. E.g, the
* description tag can get returned with
* getMeta['description']. Invalid tags will
* result in a null otherwise if the specified
* meta tag doesn't exist on the page an empty
* string is returned
*
**/
function getMeta(loadedBody)
{
	var $ = loadedBody;
	var meta = [];
	
	// Grab all the meta tags such as description, author etc
	$('meta').each(function(index)
	{
		var desc = $(this).attr('description');
		var auth = $(this).attr('author');

		if(desc != null) meta['description'] = desc;
		if(auth != null) meta['author'] = auth;
	});
	
	return meta;
}

/**
* Gets all the links on a website as
* a string array
**/
function getLinks(website, loadedBody)
{

	var urls = [];
	var $ = loadedBody;
	// Grab all the links in the web page
	$('a').each(function( index ) {
	var title = $(this).attr('href');

	if(title != null && queuedUrls.indexOf(title) == -1)
	{
		// Remove any trailing whitespace
		title = title.trim();
		// Don't queue the url twice to keep overhead down
		if(!title.startsWith("http://") && !title.startsWith("https://"))
		{
			if(!title.endsWith("/"))
			{
				title = website + title;
			} else
			{
				title = website + "/" + title;
			}
		}
		urls.push(title);
	}
	//crawl(title);

	});
	
	return urls;
}

/**
* Gets a bodies page title, these should
* be the html tag <title></title>.
* returns an empty string if there are no
* title attributes
**/
function getTitle(loadedBody)
{
	var $ = loadedBody;
	var websiteTitle = "";
	// Grab the website title
	$('title').each(function(index)
	{
		websiteTitle = $(this).text(); 
	});
	return websiteTitle;
}

function processQueue()
{
	// Process the queue from the first index
	var firstInQueue = queuedUrls.shift();
	console.log("============================================================");
	console.log(firstInQueue);
	if(firstInQueue != null)
	{
		hasCrawled(firstInQueue.url, function(found)
		{
			if(!found)
			{
				try
				{
					console.log("Processing " + firstInQueue.url);
					addCrawl(firstInQueue.url, function()
					{
						console.log("done");
						firstInQueue.call();
					});
				} catch(err)
				{
					
				}
			} else
			{
				console.log("Discarding duplicate " + firstInQueue.url);
			}
			
			setTimeout(processQueue, 2000);
		});
	}
}

setTimeout(processQueue, 3000);

/**
Request this website be crawled, will add
all the urls on this website and so forth
*/
exports.queue = function(website, callback)
{
	//console.log("Queued " + website)
	queuedUrls.push({url: website, call: callback});
}

exports.getQueued = function()
{
	return queuedUrls;
}

function isQueued(website)
{
	for(url in queuedUrls)
	{
		if(queuedUrls[url].url == website) return true;
	}
	return false;
}

exports.getCrawled = function(callback)
{
	// Query to get the urls
	var sql = "SELECT * FROM urls";
	// Our list of found urls to populate
	// Begin the query
	con.query(sql, function (err, result, fields) {
		if (err) throw err;
		// Create the crawled list
		return callback(result);
	});
	//return crawled;
	//return crawledUrls;
}

function filterLinks(strLink, options)
{
	
}