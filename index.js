var musicPlayer;
var ambiancePlayer;

function onYouTubeIframeAPIReady() {
    musicPlayer = new YT.Player('musicplayer', {
        videoId: currentMusicId,
        playerVars: {
            'loop': 0,
            'enablejsapi': 1,
            'controls': 1,
            'fs': 0,
            'color': 'white',
        },
        events: {
            'onReady': onMusicPlayerReady,
        }
    });

    ambiancePlayer = new YT.Player('ambianceplayer', {
        videoId: currentAmbianceId,
        playerVars: {
            'loop': 1,
            'enablejsapi': 1,
            'controls': 1,
            'fs': 0,
            'color': 'white',
        },
        events: {
            'onReady': onAmbiancePlayerReady,
        }
    });
}

var musicPlayerReady = false;
function onMusicPlayerReady(event) {
    musicPlayer.setVolume(0);
    musicPlayer.stopVideo();
    musicPlayerReady = true;
}

var ambiancePlayerReady = false;
function onAmbiancePlayerReady(event) {
    ambiancePlayer.setVolume(0);
    ambiancePlayer.stopVideo();
    ambiancePlayerReady = true;
}

var endPoints = null;
var totalPlayingTime = 0.0;

function calcEndPoints() {
    var musicDur = musicPlayer.getDuration() * 0.99;
    if (musicDur <= 0) // missing metadata, can't do it yet
        return;
    var musicFadeInDur = Math.min(30, 1.0 * musicDur / 10.0);
    var musicFadeOutDur = Math.min(30, 1.0 * musicDur / 10.0);
    var mainDur = musicDur - musicFadeInDur - musicFadeOutDur;
    var ambFadeOutDur = mainDur * 0.4;
    var ambFadeInDur = mainDur * 0.4;
    var middleDur = mainDur * 0.2;
    endPoints = [];
    endPoints.push(musicFadeInDur);
    endPoints.push(endPoints[0] + ambFadeOutDur);
    endPoints.push(endPoints[1] + (middleDur / 2.0));
    endPoints.push(endPoints[2] + (middleDur / 2.0));
    endPoints.push(endPoints[3] + ambFadeInDur);
    endPoints.push(musicDur);
}

function getVideoIdsPool(node) {
    return [...node.querySelectorAll('.url')]
        .filter((n) => n.querySelector('input[name="enabled"]').checked)
        .map((n) => n.querySelector('input[name="url"]').value)
        .filter(n => n)
        .map((n) => getVideoIdFromUrl(n))
        .filter(n => n);
}

function getNextVideoId(pool, current) {
    if (pool.length <= 0)
        return current;
    if (pool.length == 1)
        return (pool[0]);
    var next = current;
    while (next == current) {
        var i = rand(pool.length);
        next = (pool[i]);
    }
    return next;
}

var lastStage = -1;
function frame(deltaTime) {
    if (!musicPlayerReady || !ambiancePlayerReady) {
        statusNode.innerText = `Status: loading player`;
        return;
    }

    var playtimeVolLimit = lerp(0, 100, Math.min(totalPlayingTime, 2.0) / 2.0);
    var musicVolModifier = Math.min(musicVolumeNode.value, playtimeVolLimit);
    var ambianceVolModifier = Math.min(ambianceVolumeNode.value, playtimeVolLimit);

    if (musicPlayer.getPlayerState() != 1) {
        if (musicPlayer.getPlayerState() == 5)
            statusNode.innerText = `Status: not playing - to start, play the music video`;
        else
            statusNode.innerText = `Status: buffering`;

        ambiancePlayer.setVolume(ambianceVolModifier);
        return;
    }

    if (endPoints == null) {
        musicPlayer.seekTo(0, true);
        calcEndPoints();
        if (endPoints == null) {
            statusNode.innerText = `Status: awaiting metadata`;
            return;
        }
    }

    var time = musicPlayer.getCurrentTime();
    var stage = 0;
    while (stage < 5) {
        if (time < endPoints[stage])
            break;
        stage++;
    }

    if (ambiancePlayer.getPlayerState() != 1) {
        ambiancePlayer.playVideo();
        ambiancePlayer.setLoop(true);
    }
    else totalPlayingTime += deltaTime;

    if (time >= endPoints[5]) {
        currentMusicId = getNextVideoId(getVideoIdsPool(musicUrls), currentMusicId);
        musicPlayer.loadVideoById(currentMusicId);
        musicPlayer.setVolume(0);
        musicPlayer.seekTo(0, true);
        endPoints = null;
        statusNode.innerText = `Status: changing to next`;
        lastStage = stage;
        return;
    }

    musicPlayer.unMute();
    ambiancePlayer.unMute();
    switch (stage) {
        case 0: // music fade in
            var t = unlerp(0.0, endPoints[0], time);
            musicPlayer.setVolume(t * musicVolModifier);
            ambiancePlayer.setVolume(1 * ambianceVolModifier);
            statusNode.innerText = `Status: music fading in`;
            break;
        case 1: // ambiance fade out
            var t = unlerp(endPoints[0], endPoints[1], time);
            musicPlayer.setVolume(1 * musicVolModifier);
            ambiancePlayer.setVolume((1.0 - t) * ambianceVolModifier);
            statusNode.innerText = `Status: ambiance fading out`;
            break;
        case 2: // middle 1
            musicPlayer.setVolume(1 * musicVolModifier);
            ambiancePlayer.setVolume(0 * ambianceVolModifier);
            statusNode.innerText = `Status: middle part, no ambiance`;
            break;
        case 3: // middle 2
            if (lastStage == 2) {
                currentAmbianceId = getNextVideoId(getVideoIdsPool(ambianceUrls), currentAmbianceId);
                ambiancePlayer.loadVideoById(currentAmbianceId);
                ambiancePlayer.seekTo(0, true);
            }
            musicPlayer.setVolume(1 * musicVolModifier);
            ambiancePlayer.setVolume(0 * ambianceVolModifier);
            statusNode.innerText = `Status: middle part, no ambiance`;
            break;
        case 4: // ambiance fade in
            var t = unlerp(endPoints[3], endPoints[4], time);
            musicPlayer.setVolume(1 * musicVolModifier);
            ambiancePlayer.setVolume(t * ambianceVolModifier);
            statusNode.innerText = `Status: ambiance fading in`;
            break;
        case 5: // music fade out
            var t = unlerp(endPoints[4], endPoints[5], time);
            musicPlayer.setVolume((1.0 - t) * musicVolModifier);
            ambiancePlayer.setVolume(1 * ambianceVolModifier);
            statusNode.innerText = `Status: music fading out`;
            break;
    }

    lastStage = stage;
}

var frameCount = 0;
var targetFrameRate = 10;
var targetFrameTimeMs = 1000 / targetFrameRate;
var frameEndMs = performance.now();
function loop() {
    while (true) {
        var frameStartMs = performance.now();
        frame(Math.max(0, (frameStartMs - frameEndMs) / 1000.0));
        frameCount++;
        frameEndMs = performance.now();
        var frameTimeMs = frameEndMs - frameStartMs;
        var frameTimeLeftMs = targetFrameTimeMs - frameTimeMs;
        if (frameTimeLeftMs <= 0)
            continue;
        else {
            setTimeout(loop, frameTimeLeftMs);
            return;
        }
    }
}

function unlerp(a, b, value) {
    return (value - a) / (b - a);
}

function lerp(a, b, t) {
    return (t * b) + ((1.0 - t) * a);
}

function addUrl(parent, url, checked) {
    var newUrl = urlTemplate.cloneNode(true);
    newUrl.hidden = false;
    newUrl.querySelector('input[name="enabled"]').checked = checked ? "checked" : "";
    newUrl.querySelector('input[name="url"]').value = url;
    parent.appendChild(newUrl);
}

function rand(max) {
    return Math.floor(Math.random() * max);
}

function onAddMusicUrl(event) {
    addUrl(musicUrls, "", true);
}

function onAddAmbianceUrl(event) {
    addUrl(ambianceUrls, "", true);
}

function getVideoIdFromUrl(url) {
    const [, paramString] = url.split('?');
    if (!paramString)
        return undefined;
    var params = new URLSearchParams(paramString);
    return params.get("v") ?? undefined;
}

var statusNode = document.getElementById("status");
var musicUrls = document.getElementById("musicurls");
var ambianceUrls = document.getElementById("ambianceurls");
var urlTemplate = musicUrls.getElementsByClassName("url")[0];
var musicVolumeNode = document.getElementById("musicvolume");
var ambianceVolumeNode = document.getElementById("ambiancevolume");
document.getElementById("musicurladd").addEventListener("click", onAddMusicUrl);
document.getElementById("ambianceurladd").addEventListener("click", onAddAmbianceUrl);
var currentMusicId = getNextVideoId(getVideoIdsPool(musicUrls), '2F6B9EibJjw');
var currentAmbianceId = getNextVideoId(getVideoIdsPool(ambianceUrls), '8plwv25NYRo');
loop();