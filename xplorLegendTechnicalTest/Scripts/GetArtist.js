
//So that the enter key also triggers the search
document.getElementById("search-text").addEventListener("keyup", function (event) {
    if (event.keyCode === 13) {
        event.preventDefault();
        document.getElementById("search-button").click();
        event.target.blur();
    }

});


//Helper symbols for queryMusicBrainz helper function
const queryArtist = Symbol("queryArtist");
const queryAlbums = Symbol("queryAlbums");
const queryTracks = Symbol("queryTracks");


//Helper dictionary for queryMusicBrainz helper function
const queryStrings = {
    [queryArtist]: formatArtistQuery
    , [queryAlbums]: formatAlbumsQuery
    , [queryTracks]: formatTracksQuery
};


function initSearch() {

    searchArtist().then(albumID => getAlbumsFromArtist(albumID));

}

//get the artist data from musicbrainz
function searchArtist() {

    //get the search string value from the search-text element
    var searchString = document.getElementById("search-text").value;
    //If nothing was searched throw error
    if (searchString == "" || searchString == undefined) {
        throw new Error("Nothing was searched");
    };

    //Using the queryMusicBrainz helper function search for the artist
    return queryMusicBrainz(searchString, queryArtist).then(r => r.json()).then(r => {
        //If the artist wasnt found, throw an error
        if (r.artists == undefined) {
            throw new Error("Artist not found");
        }

        var artist = r.artists[0]

        //populate the data to pass to the template helper function
        var data = {
            "artist-name": [{ param: "textContent", value: artist.name }]
        };

        //create/clone the artist area via the createFromTemplate helper function
        var template = createFromTemplate("artist-template", data);

        if (template == undefined) {
            throw new Error("Artist Template could not be created");
        }

        //get the results area element
        var res = document.getElementById('result-area');

        //Clear out any existing data
        while (res.childElementCount > 0) {
            res.children[0].remove();
        }

        //append the artist template to the results area
        res.appendChild(template);

        //return the artist ID so we can get the album list
        return artist.id;
    });

}

//get a list of albums based on the musicbrainz artist ID
function getAlbumsFromArtist(artistID) {
    //get the album-list element, part of the artist-template
    var cont = document.getElementById('album-list');

    //if album-list doesnt exist throw and error
    if (cont == undefined) {
        throw new Error("album-list contianer could not be found");
    }

    return queryMusicBrainz(artistID, queryAlbums).then(j => j.json()).then(r => {

        var albums = r["release-groups"];
        if (albums == undefined) {
            throw new Error("No Albums Returned");
        }

        //sort the album list by release date
        albums.sort((a, b) => new Date(a["first-release-date"]) - new Date(b["first-release-date"]));

        //Loop through the albums
        albums.forEach(a => {

            //populate the data
            var data = {
                "album-title": [{ param: "textContent", value: a.title }, { param: "data-id", value: a.id }]
                , "album-release": [{ param: "textContent", value: new Date(a["first-release-date"]).toLocaleDateString() }]
            };

            //use the template helper function
            var t = createFromTemplate("album-template", data)

            if (t != undefined) {

                var ele = t.querySelector('.closed');
                var tl = t.querySelector('#track-list');
                //Setup album click event to get the song list for the album
                ele.onclick = () => {
                    if (ele.classList.contains("closed")) {
                        ele.classList.remove("closed");
                        getTracksFromAlbum(a.id, tl);
                    }
                };

                cont.appendChild(t);
            }
            else {
                throw new Error("Album Template could not be created");
            }
        });
    });
}

//get a list of tracks and fill the passed container element
function getTracksFromAlbum(albumID, cont) {
    //Check if cont is a HTMLElement
    if (!(cont instanceof HTMLElement)) {
        throw new Error("Passed container not HTML element");
    }

    //use queryMusicBrainz helper function
    return queryMusicBrainz(albumID, queryTracks).then(j => j.json()).then(r => {

        //Check if any of the properties we need are undefined
        if (r?.releases[0]?.media[0]?.tracks == undefined) {
            throw new Error("No Tracks Found");
        }

        //Loop throught he tracks
        r.releases[0].media[0].tracks.forEach(t => {

            //the lendth is provided in milliseconds, so we need to convert it into something easier to read
            var l = new Date(0);
            l.setMilliseconds(t.length);

            //Create the data we will pass to the template helper function
            var data = {
                "track-postion": [{ param: "textContent", value: t.position }]
                , "track-title": [{ param: "textContent", value: t.title }]
                , "track-length": [{ param: "textContent", value: l.toISOString().substr(14, 5) }]
            };

            //Use the template helper function
            var tmp = createFromTemplate("track-template", data);

            //Check if the helper function returned the nothing
            if (tmp == undefined) {
                throw new Error("Failed to create track template element");
            }

            //Append the template to the passed container
            cont.appendChild(tmp);

        });

    });

}


///Helper function for creating/cloning a template and populating it with some basic information
///fillData example {artist-name:[{param:textContent, value:"Queen"}]}
///                 {track-title:[{param:textContent, value:""}],track-position:[{param:textContent, value:""}]}
function createFromTemplate(template, fillData) {
    //check if the template parameter is a HTMLTemplateElement
    if (!(template instanceof HTMLTemplateElement)) {
        //if it isnt, assume that template is the element ID
        template = document.getElementById(template);
    }

    //template is undefined or not a template or filldata isnt an object, return
    if (template == undefined || !(template instanceof HTMLTemplateElement) || !(fillData instanceof Object)) return;

    //clone the contents of the template
    template = template.content.cloneNode(true);

    //loop through the keys if fillData
    Object.keys(fillData).forEach(f => {
        //find the element, by id, using the key
        var ele = template.querySelector(`#${f}`);
        if (ele == undefined) return;

        //Loop though the array of the f object key
        fillData[f].forEach(p => {
            //Assign the value to the property within the array
            ele[p.param] = p.value;
        });
    });

    //return the cloned template
    return template;

}

//helper function for formatting the url to return the artist from a search string
function formatArtistQuery(query) {
    var queryString = 'https://musicbrainz.org/ws/2/artist/?query=artist:';
    queryString += `"${encodeURI(query)}"&fmt=json`;
    return queryString;
}

//helper function for formatting the url to return a list of albums
function formatAlbumsQuery(query) {
    return `https://musicbrainz.org/ws/2/release-group?artist=${query}&type=album&fmt=json`;
}

//helper function for formatting the url to return a list of tracks
function formatTracksQuery(query) {
    return `https://musicbrainz.org/ws/2/release?release-group=${query}&inc=recordings&fmt=json`;
}

function formatArtQuery(query) {
    return `https://coverartarchive.org/release-group/${query}`;
}

//Helper function for querying musicbrainz
function queryMusicBrainz(query, queryType) {
    //check to see if the queryType is valid
    if (queryStrings[queryType] == undefined) {
        throw new Error("invalid query type passed to queryMusicBrainz");
    }

    //instead of using a switch or if/else if statement use a dictionary/object
    var url = queryStrings[queryType](query);

    //musicbrainz requested that you send your email with your app name as the User-Agent
    var h = new Headers({
        "Accept": "application / json",
        "Content-Type": "application/json",
        "User-Agent": "xplorTechnicalTest/1.0 (Alex.Rosaman@gmail.com)"
    });

    return fetch(url, { method: 'GET', headers: h });

}