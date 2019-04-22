var rssURLs = {
    'nfl': 'https://www.cbssports.com/rss/headlines/nfl/',
    'mlb': 'https://www.cbssports.com/rss/headlines/mlb/',
    'nhl': 'https://www.cbssports.com/rss/headlines/nhl/',
};

var feedsToUse = [];
var intervalID;
var favorites = [];
var currentUser;
var filter = false;

document.addEventListener("DOMContentLoaded", () => {
    var username = localStorage.getItem('username');
    if(username !== null) {
        loginUser(username);
    }
    initRefresh();
    var last = localStorage.getItem('last');
    if(last !== null) {
        document.getElementById('last-visited').textContent = 'last visited: ' + last.toLocaleString();
    }
    localStorage.setItem('last', Date.now());
});

function loginUser(username) {
    document.getElementById('username-display').textContent = 'Logged in as ' + username;
    document.getElementById('button-submit').classList.remove("pure-button-primary");
    localStorage.setItem('username', username);
    document.cookie = 'username=' + username;
    currentUser = username;
    initRefresh();
}

async function signin() {
    var credentials = await (await fetch('users.json')).json();
    var username = document.getElementById('user-input').value;
    var password = document.getElementById('pass-input').value;

    if (!(username in credentials)) {
        credentials[username] = password;
        fetch('newuser.php', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(credentials),
        });
        alert('New user created');
    }

    if (credentials[username] !== password) {
        alert('Incorrect password');
        return;
    }

    loginUser(username);
}

function favoriteEvent(checkbox) {
    var index = favorites.indexOf(checkbox.value);
    if(checkbox.checked && index < 0) {
        favorites.push(checkbox.value);
    } else if(!checkbox.checked && index >= 0) {
        favorites.splice(index, 1);
    }

    fetch('writefavorites.php', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(favorites),
    });
}

function applyItems(items) {
    var newContainer = document.createElement('div');
    newContainer.id = 'items-list';
    newContainer.className = 'pure-g';

    items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    for (var item of items) {
        if(filter && !favorites.includes(item.guid)) {
            continue;
        }
        var newItemDiv = document.createElement('div');
        newItemDiv.className = 'feed-card pure-u-1 pure-u-lg-1-2 pure-u-xl-1-3';

        var title = document.createElement('p');
        var link = document.createElement('a');
        link.href = item.link;
        link.textContent = item.title;
        title.appendChild(link);
        newItemDiv.appendChild(title);

        var line2 = document.createElement('p');

        var date = document.createElement('span');
        date.textContent = new Date(item.pubDate).toLocaleString();
        line2.appendChild(date);

        if(currentUser !== undefined) {
            var favorite = document.createElement('span');
            favorite.className = 'right';
            favorite.textContent = 'Favorite: ';

            var checkbox = document.createElement('input');
            checkbox.setAttribute('type', 'checkbox');
            checkbox.setAttribute('value', item.guid);
            checkbox.setAttribute('onclick', 'favoriteEvent(this)');
            if(favorites.includes(item.guid)) {
                checkbox.setAttribute('checked', '');
            }
            favorite.appendChild(checkbox);

            line2.appendChild(favorite);
        }

        newItemDiv.appendChild(line2);

        newContainer.appendChild(newItemDiv);
    }

    var oldContainer = document.getElementById('items-list');
    oldContainer.parentNode.replaceChild(newContainer, oldContainer);
}

async function refreshFeeds() {
    if(currentUser !== undefined) {
        try {
            favorites = await (await fetch('data/' + currentUser + '.json')).json();
        } catch (err) {
            favorites = [];
        }
    }
    var requests = [];
    for (var feedID of feedsToUse) {
        requests.push(getFeed(rssURLs[feedID]));
    }
    var items = await Promise.all(requests);
    items = items.flat(1);
    applyItems(items);
}

async function getFeed(url) {
    var text = await (await fetch(url)).text();
    var xml = new DOMParser().parseFromString(text, 'text/xml');
    var items = [];
    for (var item of xml.getElementsByTagName('item')) {
        items.push(xmlToJson(item));
    }
    return items;
}

function handleCheckbox() {
    filter = document.getElementById('fav').checked;
    var checkboxes = document.getElementsByClassName('feed-checkbox');
    feedsToUse = [];
    for (var checkbox of checkboxes) {
        if (checkbox.checked) {
            feedsToUse.push(checkbox.value);
        }
    }
    initRefresh();
}

function initRefresh() {
    if (intervalID !== undefined) {
        clearInterval(intervalID);
    }
    refreshFeeds();
    intervalID = setInterval(refreshFeeds, 60 * 1000);
}

function xmlToJson(xml) { // https://gist.github.com/chinchang/8106a82c56ad007e27b1

    // Create the return object
    var obj = {};

    if (xml.nodeType == 1) { // element
        // do attributes
        if (xml.attributes.length > 0) {
            obj["@attributes"] = {};
            for (var j = 0; j < xml.attributes.length; j++) {
                var attribute = xml.attributes.item(j);
                obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
            }
        }
    } else if (xml.nodeType == 3) { // text
        obj = xml.nodeValue.trim();
    }

    // do children
    // If just one text node inside
    if (xml.hasChildNodes() && xml.childNodes.length === 1 && xml.childNodes[0].nodeType === 3) {
        obj = xml.childNodes[0].nodeValue.trim();
    }
    else if (xml.hasChildNodes()) {
        for (var i = 0; i < xml.childNodes.length; i++) {
            var item = xml.childNodes.item(i);
            var nodeName = item.nodeName;
            if (typeof (obj[nodeName]) == "undefined") {
                obj[nodeName] = xmlToJson(item);
            } else {
                if (typeof (obj[nodeName].push) == "undefined") {
                    var old = obj[nodeName];
                    obj[nodeName] = [];
                    obj[nodeName].push(old);
                }
                obj[nodeName].push(xmlToJson(item));
            }
        }
    }
    return obj;
}