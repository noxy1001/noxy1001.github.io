const clientId = '1l51yhrtds5wg4757q3uduiq6apo6f';
const redirectUri = 'https://noxy1001.github.io'; 
let accessToken = null;
let twitchUser = null;
let chatClient = null;
let npEnabled = false; 
let tosumemoryInterval = null;
let lastNpCommandTime = 0; 

document.getElementById('loginButton').addEventListener('click', function() {
    const authUrl = `https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:bot+chat:read+chat:edit&force_verify=true`;
    window.location.href = authUrl;
});

document.getElementById('disconnectButton').addEventListener('click', function() {
    accessToken = null;
    twitchUser = null;
    document.getElementById('status').innerText = "Not connected";
    document.getElementById('loginButton').style.display = "inline";
    document.getElementById('disconnectButton').style.display = "none";
    document.getElementById('nowPlaying').innerHTML = ''; 
    document.getElementById('enableNpButton').style.display = "none"; 
    document.getElementById('tosuStatus').innerText = ''; 
    document.getElementById('tokenInput').value = '';
    history.replaceState(null, '', redirectUri);
    window.location.reload();
});

function getTokenFromUrl() {
    const hash = window.location.hash;
    if (hash) {
        const token = new URLSearchParams(hash.substring(1)).get('access_token');
        history.replaceState(null, '', redirectUri); 
        return token;
    }
    return null;
}

function updateUI() {
    document.getElementById('status').innerText = `Logged as ${twitchUser}`; 
    document.getElementById('nowPlaying').innerText = `enable !np MOLU`; 
    document.getElementById('loginButton').style.display = "none";
    document.getElementById('disconnectButton').style.display = "inline";
    document.getElementById('enableNpButton').style.display = "inline";
    document.getElementById('tokenInput').value = accessToken;
}

accessToken = getTokenFromUrl();
if (accessToken) {
    fetch('https://api.twitch.tv/helix/users', {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Client-ID': clientId
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error retrieving Twitch user data');
        }
        return response.json();
    })
    .then(data => {
        if (data.data && data.data.length > 0) {
            twitchUser = data.data[0].login; 
            updateUI(); 
        } else {
            throw new Error('Failed to get user nickname');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('status').innerText = "Error retrieving Twitch user data";
    });
}

function getNowPlaying() {
    return fetch('http://localhost:24050/json')
        .then(response => {
            if (!response.ok) throw new Error('Tosu не запущен');
            return response.json();
        })
        .then(data => {
            if (data && data.menu && data.menu.bm && data.menu.bm.metadata) {
                const mapTitle = data.menu.bm.metadata.title;
                const mapArtist = data.menu.bm.metadata.artist;
                const mapDifficulty = data.menu.bm.metadata.difficulty;
                const beatmapUrl = `https://osu.ppy.sh/beatmapsets/${data.menu.bm.set}#osu/${data.menu.bm.id}`;
                
                document.getElementById('nowPlaying').innerHTML = 
                    `Now playing: <strong>${mapArtist} - ${mapTitle} [${mapDifficulty}]</strong> <br> <a href="${beatmapUrl}" target="_blank">Map link</a>`;
                
                document.getElementById('tosuStatus').innerText = 'Tosu запущен!';
                document.getElementById('tosuStatus').style.color = 'green';
                
                return `${mapArtist} - ${mapTitle} [${mapDifficulty}] | ${beatmapUrl}`;
            } else {
                document.getElementById('nowPlaying').innerText = "Unable to retrieve information about the current map.";
                return null;
            }
        })
        .catch(error => {
            document.getElementById('nowPlaying').innerText = ''; 
            document.getElementById('tosuStatus').innerText = "Tosu не запущен.";
            document.getElementById('tosuStatus').style.color = 'red';
            console.error("Error:", error);
            return null;
        });
}

function connectTwitchChat() {
    chatClient = new tmi.Client({
        options: { debug: true },
        identity: {
            username: twitchUser,
            password: `oauth:${accessToken}`
        },
        channels: [twitchUser]
    });

    chatClient.connect();

    chatClient.on('message', (channel, tags, message, self) => {
        if (self) return;

        const cooldown = parseInt(document.getElementById('npCooldown').value);  // Время кулдауна, по умолчанию 10 секунд
        const currentTime = Date.now();  // Текущее время

        if (message.toLowerCase() === '!np' && npEnabled) {
            if (currentTime - lastNpCommandTime >= cooldown * 1000) {  // Проверка кулдауна
                getNowPlaying().then(nowPlaying => {
                    if (nowPlaying) {
                        chatClient.say(channel, `Now playing: ${nowPlaying}`);
                        lastNpCommandTime = currentTime;  // Обновляем время последнего вызова
                    }
                });
            }
        }
    });
}

document.getElementById('enableNpButton').addEventListener('click', function() {
    npEnabled = !npEnabled;

    if (npEnabled) {
        document.getElementById('nowPlaying').innerText = ''; 
        this.innerText = 'Disable !np'; 
        connectTwitchChat();
        tosumemoryInterval = setInterval(getNowPlaying, 1000);
    } else {
        if (chatClient) {
            chatClient.disconnect();
            chatClient = null;
        }
        this.innerText = 'Enable !np';
        document.getElementById('nowPlaying').innerText = '!np disabled SadCat'; 
        document.getElementById('tosuStatus').innerText = ''; 
        clearInterval(tosumemoryInterval); 
    }
});
