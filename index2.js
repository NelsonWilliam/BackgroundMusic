var musicPlayer;
var ambiancePlayer;
var musicVideoId;
var ambianceVideoId;
var musicPlayerState;
var ambiancePlayerState;
var musicTargetVolume;
var ambianceTargetVolume;
var musicFadeSecsNode;
var ambianceFadeSecsNode;
var musicVolumeNode;
var ambianceVolumeNode;
let musicIsLoading;
let ambianceIsLoading;
var musicListNode;
var ambianceListNode;
var musicMaxMinutesNode;
var ambianceMaxMinutesNode;

function getNextVideoId(currentId, listNode) {
    // TODO: always use first one and move to the bottom of the list
    var urls = fetchVideoIdsFromList(listNode);
    if (urls.length <= 0) return currentId;
    if (urls.length == 1) return urls[0];
    var next = currentId;
    while (next == currentId)
        next = urls[Math.floor(Math.random() * urls.length)];
    return next;
}

function fetchVideoIdsFromList(listNode) {
    return [...listNode.querySelectorAll('.list-item')]
        .filter((n) => n.querySelector('input[name="enabled"]').checked)
        .map((n) => n.querySelector('input[name="url"]').value)
        .filter(n => n)
        .map((n) => parseVideoIdFromUrl(n))
        .filter(n => n);
}

function parseVideoIdFromUrl(url) {
    // From https://stackoverflow.com/questions/71000139/javascript-regex-for-youtube-video-and-shorts-id
    const regex = /(youtu.*be.*)\/(watch\?v=|embed\/|v|shorts|)(.*?((?=[&#?])|$))/gm;
    const result = regex.exec(url);
    return result ? result[3] : null;
}

function addVideoListItem(listNode, listAddNode, templateNode, url, enabled) {
    const newNode = templateNode.cloneNode(true);
    newNode.style = '';
    newNode.id = '';
    newNode.querySelector('input[name="enabled"]').checked = enabled ? "checked" : "";
    newNode.querySelector('input[name="url"]').value = url;
    newNode.querySelector('button').addEventListener('click', (event) => {
        newNode.remove();
    });
    listNode.insertBefore(newNode, listAddNode);
}

function onNextMusic() {
    if (musicIsLoading) {
        console.log("Can't begin load while previous isn't finished");
        return;
    }

    musicVideoId = getNextVideoId(musicVideoId, musicListNode);
    if (!musicVideoId) {
        console.log("No valid video ID was found");
        return;
    }

    musicIsLoading = true;
    musicPlayerState = undefined;
    musicPlayer.loadVideoById(musicVideoId);
    musicPlayer.setVolume(0);
    musicPlayer.mute();

    // Check until video is loaded
    const interval = setInterval(() => {
        if (musicPlayerState == 1) { // Playing
            musicPlayer.seekTo(0, true);
            musicPlayer.setVolume(0);
            musicPlayer.unMute();
            musicIsLoading = false;
            clearInterval(interval);
        }
    }, 100);
}

function onNextAmbiance() {
    if (ambianceIsLoading) {
        console.log("Can't begin load while previous isn't finished");
        return;
    }

    ambianceVideoId = getNextVideoId(ambianceVideoId, ambianceListNode);
    if (!ambianceVideoId) {
        console.log("No valid video ID was found");
        return;
    }

    ambianceIsLoading = true;
    ambiancePlayerState = undefined;
    ambiancePlayer.loadVideoById(ambianceVideoId);
    ambiancePlayer.setVolume(0);
    ambiancePlayer.mute();

    // Check until video is loaded
    const interval = setInterval(() => {
        if (ambiancePlayerState == 1) { // Playing
            ambiancePlayer.seekTo(0, true);
            ambiancePlayer.setVolume(0);
            ambiancePlayer.unMute();
            ambianceIsLoading = false;
            clearInterval(interval);
        }
    }, 100);
}

function onPlayOrPause() {
    if (musicPlayerState == undefined || musicPlayerState < 0) {
        onNextMusic();
    }
    else if (musicPlayerState == 2) {
        musicPlayer.playVideo();
    } else if (musicPlayerState == 1 || musicPlayerState == 3) {
        musicPlayer.pauseVideo();
    }

    if (ambiancePlayerState == undefined || ambiancePlayerState < 0)
        onNextAmbiance();
    else if (ambiancePlayerState == 2) {
        ambiancePlayer.playVideo();
    } else if (ambiancePlayerState == 1 || ambiancePlayerState == 3) {
        ambiancePlayer.pauseVideo();
    }
}

function updatePlayerVolumes() {
    if (musicPlayerState > 0 && !musicIsLoading) {
        let musicEnded;
        [musicTargetVolume, musicEnded] = calcPlayerTargetVolume(musicPlayer, musicPlayerState, musicFadeSecsNode, musicVolumeNode, musicMaxMinutesNode);
        musicPlayer.setVolume(lerp(musicPlayer.getVolume(), musicTargetVolume, 0.4));
        if (musicEnded) {
            onNextMusic();
        }
    }

    if (ambiancePlayerState > 0 && !ambianceIsLoading) {
        let ambianceEnded;
        [ambianceTargetVolume, ambianceEnded] = calcPlayerTargetVolume(ambiancePlayer, ambiancePlayerState, ambianceFadeSecsNode, ambianceVolumeNode, ambianceMaxMinutesNode);
        ambiancePlayer.setVolume(lerp(ambiancePlayer.getVolume(), ambianceTargetVolume, 0.4));
        if (ambianceEnded) {
            onNextAmbiance();
        }
    }
}

function calcPlayerTargetVolume(player, playerState, fadeSecsNode, maxVolumeNode, maxMinutesNode) {
    if (playerState == undefined || playerState < 0)
        return [undefined, undefined]; // Invalid state
    const time = player.getCurrentTime();
    let duration = player.getDuration();
    if (time == undefined || !duration)
        return [undefined, undefined]; // Missing metadata
    duration = Math.min(duration, (parseFloat(maxMinutesNode.value) * 60) || duration);
    if (playerState == 0 || time >= duration)
        return [0.0, true]; // Ended
    if (playerState != 1 && playerState != 3)
        return [undefined, undefined]; // Not playing

    const fadeDuration = Math.min(duration, Math.max(parseFloat(fadeSecsNode.value) || 1.0, 1.0)) / 2.0;
    const fadeInEnd = fadeDuration;
    const fadeOutStart = duration - fadeDuration;
    const maxVolume = clamp(parseFloat(maxVolumeNode.value) || 0.0, 0.0, 100.0);

    if (time < fadeInEnd) {
        return [maxVolume * unlerp(0, fadeInEnd, time), false];
    } else if (time > fadeOutStart) {
        return [maxVolume * (1.0 - Math.min(1.0, unlerp(fadeOutStart, duration, time))), false];
    } else {
        return [maxVolume, false];
    }
}

function onPlayersReady() {
    const musicFrameNode = document.getElementById("music-frame");
    const ambianceFrameNode = document.getElementById("ambiance-frame");
    const templateListItemNode = document.getElementById("template-list-item");
    const musicListAddNode = document.getElementById("music-list-add");
    const ambianceListAddNode = document.getElementById("ambiance-list-add");
    const playBtnNode = document.getElementById("control-play");
    const nextMusicBtnNode = document.getElementById("control-next-music");
    const nextAmbianceBtnNode = document.getElementById("control-next-ambiance");
    musicListNode = document.getElementById("music-list");
    ambianceListNode = document.getElementById("ambiance-list");
    musicFadeSecsNode = document.getElementById("music-fade-secs");
    ambianceFadeSecsNode = document.getElementById("ambiance-fade-secs");
    musicVolumeNode = document.getElementById("music-volume");
    ambianceVolumeNode = document.getElementById("ambiance-volume");
    musicMaxMinutesNode = document.getElementById("music-max-mins");
    ambianceMaxMinutesNode = document.getElementById("ambiance-max-mins");

    // TODO: Persisted saved settings or initialize to defaults (?)
    addVideoListItem(musicListNode, musicListAddNode, templateListItemNode, "https://www.youtube.com/watch?v=2F6B9EibJjw", true);
    addVideoListItem(musicListNode, musicListAddNode, templateListItemNode, "https://www.youtube.com/watch?v=7JMvn0wfABQ", true);
    addVideoListItem(musicListNode, musicListAddNode, templateListItemNode, "https://www.youtube.com/watch?v=FjHGZj2IjBk", true);
    addVideoListItem(musicListNode, musicListAddNode, templateListItemNode, "https://www.youtube.com/watch?v=HXUy3EaVmXQ", true);
    addVideoListItem(musicListNode, musicListAddNode, templateListItemNode, "https://www.youtube.com/watch?v=ZkiMk2PUZQA", true);
    addVideoListItem(musicListNode, musicListAddNode, templateListItemNode, "https://www.youtube.com/watch?v=htnobkrtDoo", true);
    addVideoListItem(musicListNode, musicListAddNode, templateListItemNode, "https://www.youtube.com/watch?v=qj9NFFvJ7o4", true);
    addVideoListItem(musicListNode, musicListAddNode, templateListItemNode, "https://www.youtube.com/watch?v=lTRiuFIWV54", true);
    addVideoListItem(ambianceListNode, ambianceListAddNode, templateListItemNode, "https://www.youtube.com/watch?v=8plwv25NYRo", true);
    addVideoListItem(ambianceListNode, ambianceListAddNode, templateListItemNode, "https://www.youtube.com/watch?v=mPZkdNFkNps", true);
    addVideoListItem(ambianceListNode, ambianceListAddNode, templateListItemNode, "https://www.youtube.com/watch?v=IMV3CHy9uzE", true);
    addVideoListItem(ambianceListNode, ambianceListAddNode, templateListItemNode, "https://www.youtube.com/watch?v=nDqP7kcr-sc", true);
    addVideoListItem(ambianceListNode, ambianceListAddNode, templateListItemNode, "https://www.youtube.com/watch?v=RqzGzwTY-6w", true);
    addVideoListItem(ambianceListNode, ambianceListAddNode, templateListItemNode, "https://www.youtube.com/watch?v=xNN7iTA57jM", true);
    addVideoListItem(ambianceListNode, ambianceListAddNode, templateListItemNode, "https://www.youtube.com/watch?v=eH-_GMhH-kk", true);
    addVideoListItem(ambianceListNode, ambianceListAddNode, templateListItemNode, "https://www.youtube.com/watch?v=CLKvhtS51us", true);

    playBtnNode.addEventListener('click', onPlayOrPause);
    nextMusicBtnNode.addEventListener('click', onNextMusic);
    nextAmbianceBtnNode.addEventListener('click', onNextAmbiance);
    musicListAddNode.addEventListener('click', () => {
        addVideoListItem(musicListNode, musicListAddNode, templateListItemNode, '', true);
    });
    ambianceListAddNode.addEventListener('click', () => {
        addVideoListItem(ambianceListNode, ambianceListAddNode, templateListItemNode, '', true);
    });

    // Constantly update the volume towards our desired targets
    musicPlayer.setVolume(0);
    ambiancePlayer.setVolume(0);
    musicTargetVolume = 0.0;
    ambianceTargetVolume = 0.0;
    setInterval(updatePlayerVolumes, 100);

    // Update play/pause button according to state of music player
    var musicTargetBrightness = 0.0;
    var musicBrightness = 0.0;
    var ambianceTargetBrightness = 0.0;
    var ambianceBrightness = 0.0;
    setInterval(() => {
        nextMusicBtnNode.disabled = musicPlayerState == undefined ? 'disabled' : '';
        nextAmbianceBtnNode.disabled = ambiancePlayerState == undefined ? 'disabled' : '';
        if (musicPlayerState == 1 || musicPlayerState == 3 || ambiancePlayerState == 1 || ambiancePlayerState == 3)
            playBtnNode.value = "Pause";
        else
            playBtnNode.value = "Play";

        musicTargetBrightness = remap(musicIsLoading ? 0 : musicPlayer.getVolume(), 0, 100, 0.1, 1);
        musicBrightness = lerp(musicBrightness, musicTargetBrightness, 0.2);
        musicFrameNode.style.filter = `brightness(${musicBrightness})`;
        
        ambianceTargetBrightness = remap(ambianceIsLoading ? 0 : ambiancePlayer.getVolume(), 0, 100, 0.1, 1);
        ambianceBrightness = lerp(ambianceBrightness, ambianceTargetBrightness, 0.2);
        ambianceFrameNode.style.filter = `brightness(${ambianceBrightness})`;
    }, 30);

    // Fade in the website after everything is setup
    document.documentElement.style.animationName = "html-fadein";
}

function onYouTubeIframeAPIReady() {
    const tempMusicPlayer = new YT.Player('music-frame', {
        playerVars: {
            'enablejsapi': 1,
            'controls': 0,
            'fs': 0,
        },
        events: {
            'onReady': () => {
                musicPlayer = tempMusicPlayer;
                if (ambiancePlayer)
                    onPlayersReady();
            },
            'onStateChange': (e) => {
                musicPlayerState = e.data;
            },
        }
    });
    const tempAmbiancePlayer = new YT.Player('ambiance-frame', {
        playerVars: {
            'enablejsapi': 1,
            'controls': 0,
            'fs': 0,
        },
        events: {
            'onReady': () => {
                ambiancePlayer = tempAmbiancePlayer;
                if (musicPlayer)
                    onPlayersReady();
            },
            'onStateChange': (e) => {
                ambiancePlayerState = e.data;
            }
        }
    });
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
};

function unlerp(a, b, value) {
    return (value - a) / (b - a);
}

function lerp(a, b, t) {
    return (t * b) + ((1.0 - t) * a);
}

function remap(value, oldMin, oldMax, newMin, newMax) {
    return lerp(newMin, newMax, unlerp(oldMin, oldMax, value));
}