function setupTrackListItem(itemNode, trackNode, options) {
    options ||= {};

    // Setup removing itself
    const removeBtn = itemNode.querySelector("[name='remove-btn']");
    removeBtn.addEventListener('click', () => removeItem());
    function removeItem() {
        itemNode.remove();
    }

    // Setup initial values
    if (options.url) {
        const urlNode = itemNode.querySelector("[name='url']");
        urlNode.value = options.url;
    }
    if (options.enabled) {
        const enabledNode = itemNode.querySelector("[name='enabled']");
        enabledNode.checked = options.enabled ? "checked" : "";
    }
}

function setupTrack(trackNode, options) {
    options ||= {};

    // Setup removing itself
    const removeBtn = trackNode.querySelector("[name='remove-track-btn']");
    removeBtn.addEventListener('click', () => removeTrack());
    function removeTrack() {
        trackNode.remove();

        // Remove from global list of players
        const index = players.findIndex(i => i.player == ytPlayer);
        if (index >= 0)
            players.splice(index, 1);
    }

    // Setup adding list items by cloning the template
    const itemListNode = trackNode.getElementsByClassName("track-list")[0];
    const templateItemNode = itemListNode.getElementsByClassName("track-list-item")[0];
    templateItemNode.style.display = 'none';
    const itemListHeaderNode = itemListNode.getElementsByClassName("track-list-header")[0];
    const itemListFooterNode = itemListNode.getElementsByClassName("track-list-footer")[0];
    const addItemkBtnNode = itemListFooterNode.querySelector("[name='add-btn']");
    addItemkBtnNode.addEventListener('click', () => addItem());
    function addItem(options) {
        const itemNode = templateItemNode.cloneNode(true);
        itemNode.style.display = '';
        setupTrackListItem(itemNode, trackNode, options);
        itemListNode.insertBefore(itemNode, itemListFooterNode);
    }

    // Add initial urls, if any
    if (options.initialUrls) {
        for (const url of options.initialUrls)
            addItem({ url: url });
    }

    // Setup controls
    const controlsNode = trackNode.getElementsByClassName("track-controls")[0];
    const randomOrderNode = controlsNode.querySelector("[name='random-order']");
    const randomStartNode = controlsNode.querySelector("[name='random-start']");
    const maxMinutesNode = controlsNode.querySelector("[name='max-minutes']");
    const volumeNode = controlsNode.querySelector("[name='volume']");
    const fadeNode = controlsNode.querySelector("[name='fade']");

    // Setup player
    let ytPlayer = undefined;
    let ytPlayerIsBusy = false;
    let currentVideoId = undefined;
    let currentVideoStart = undefined;
    const playerNode = trackNode.getElementsByClassName("track-player")[0];
    let playerFrameNode = playerNode.getElementsByClassName("track-player-frame")[0];
    const nextBtnNode = playerNode.querySelector("[name='next-btn']");
    const playerTitleNode = playerNode.querySelector("[name='track-title']");
    nextBtnNode.innerText = "Start";
    nextBtnNode.addEventListener('click', () => nextVideo(false));
    playerFrameNode.style.filter = `brightness(0)`;
    function nextVideo(nextVideoId) {
        if (ytPlayerIsBusy) {
            showToast("Calm down!", 'error');
            return;
        }

        // Initialize player when advancing of the first time
        if (!ytPlayer) {
            nextVideoId = nextVideoId || getNextVideoId();
            if (!nextVideoId) {
                showToast("Track is missing a video URL", 'error');
                return;
            }

            ytPlayerIsBusy = true;
            const tempPlayer = new YT.Player(playerFrameNode, {
                playerVars: {
                    'enablejsapi': 1,
                    'disablekb': 1,
                    'controls': 0,
                },
                events: {
                    'onReady': () => {
                        playerFrameNode = playerNode.getElementsByClassName("track-player-frame")[0];
                        ytPlayer = tempPlayer;
                        ytPlayerIsBusy = false;
                        players.push({
                            player: ytPlayer,
                            onNext: nextVideo,
                            onPause: () => {
                                const state = ytPlayer.getPlayerState();
                                if (state == 1 || state == 3)
                                    ytPlayer.pauseVideo();
                            },
                            onUnpause: () => {
                                const state = ytPlayer.getPlayerState();
                                if (state == 2)
                                    ytPlayer.playVideo();
                            },
                            updateVolume: () => {

                                const time = ytPlayer.getCurrentTime();
                                const videoDuration = ytPlayer.getDuration();
                                if (ytPlayerIsBusy || !videoDuration || time === undefined)
                                    return;

                                const maxDuration = maxMinutesNode.value * 60;
                                let duration = videoDuration - currentVideoStart;
                                if (maxDuration)
                                    duration = Math.min(duration, maxDuration);

                                let fadeDuration = fadeNode.value;
                                if (fadeDuration)
                                    fadeDuration = Math.min(duration / 2.0, fadeDuration);
                                else
                                    fadeDuration = 0.0;

                                const fadeInStart = currentVideoStart;
                                const fadeInEnd = fadeInStart + fadeDuration;
                                const fadeOutStart = fadeInStart + duration;
                                const fadeOutEnd = fadeOutStart + fadeDuration;
                                const targetVolume = Math.min(Math.max(0, volumeNode.value), 100);
                                let newVolume = 0;
                                if (time > fadeOutEnd + 1) {
                                    ytPlayer.setVolume(0);
                                    nextVideo();
                                    return;
                                } else if (time > fadeOutEnd) {
                                    newVolume = 0;
                                } else if (time < fadeInEnd) {
                                    newVolume = targetVolume * unlerp(fadeInStart, fadeInEnd, time);
                                } else if (time > fadeOutStart) {
                                    newVolume = targetVolume * (1.0 - Math.min(1.0, unlerp(fadeOutStart, fadeOutEnd, time)));
                                } else {
                                    newVolume = targetVolume;
                                }
                                ytPlayer.setVolume(newVolume);                                
                                playerFrameNode.style.filter = `brightness(${newVolume / 100.0})`;
                            },
                        });
                        // Advance to the first video
                        nextVideo(nextVideoId);
                    },
                    'onStateChange': (e) => {
                        // Advance when video ended                
                        if (!ytPlayerIsBusy && e.data === 0) {
                            nextVideo();
                        }
                    },
                }
            });
        }
        // Advance track when player is already initialized
        else {
            nextVideoId = nextVideoId || (getNextVideoId() || currentVideoId);
            if (!nextVideoId) {
                showToast("Track is missing a video URL", 'error');
                return;
            }

            ytPlayerIsBusy = true;
            ytPlayer.loadVideoById(nextVideoId);
            ytPlayer.mute();
            ytPlayer.setVolume(0);
            playerTitleNode.innerText = "Loading..."
            playerFrameNode.style.filter = `brightness(0)`;

            // Constantly check until the video is actually loaded,
            // but give up if it take too long (eg. unavailable video)
            let interval;
            const timeout = setTimeout(() => {
                const playerState = ytPlayer.getPlayerState();
                if (playerState == -1) {
                    ytPlayerIsBusy = false;
                    clearInterval(interval);
                    nextVideo();
                    return;
                }
            }, 2000);
            interval = setInterval(() => {
                const playerState = ytPlayer.getPlayerState();
                if (playerState == 1) {
                    nextBtnNode.innerText = "Advance";

                    currentVideoStart = 0;
                    if (randomStartNode.checked) {
                        // find a random starting position in the next 1/2 of the video
                        const max = Math.max(1, ytPlayer.getDuration() / 2.0);
                        currentVideoStart = getRandomInt(0, max);
                    }

                    ytPlayer.seekTo(currentVideoStart, true);
                    ytPlayer.unMute();
                    ytPlayer.setVolume(0);
                    playerTitleNode.innerText = playerFrameNode.getAttribute("title");
                    currentVideoId = nextVideoId;
                    ytPlayerIsBusy = false;
                    clearInterval(interval);
                    clearTimeout(timeout);
                }
            }, 50);
        }

        function getNextVideoId() {
            //  Fetch valid-looking IDs from track list
            const items = [...itemListNode.getElementsByClassName("track-list-item")]
                .filter((itemNode) => itemNode.querySelector('input[name="enabled"]').checked)
                .map((itemNode) => { return { node: itemNode, url: itemNode.querySelector('input[name="url"]').value }; })
                .filter((item) => item.url)
                .map((item) => {
                    // From https://stackoverflow.com/questions/71000139/javascript-regex-for-youtube-video-and-shorts-id
                    const regex = /(youtu.*be.*)\/(watch\?v=|embed\/|v|shorts|)(.*?((?=[&#?])|$))/gm;
                    const result = regex.exec(item.url);
                    const id = result ? result[3] : null;
                    return { ...item, id: id };
                })
                .filter((item) => item.id);

            if (items.length == 0)
                return undefined;

            let chosenItem;
            if (randomOrderNode.checked) {
                // Chose a random item from the bottom half
                const min = Math.floor(items.length / 2);
                const maxExclusive = items.length;
                chosenItem = items[getRandomInt(min, maxExclusive)];
            } else {
                // Chose the bottommost item
                chosenItem = items[items.length - 1];
            }

            // Pull chosen item back to the top
            itemListHeaderNode.after(chosenItem.node);
            return chosenItem.id;
        }
    }
}

const players = [];
function setupPage() {
    // Setup adding tracks by cloning the template
    const templateTrackNode = document.getElementsByClassName("track")[0];
    templateTrackNode.style.display = 'none';
    const tracksNode = document.getElementById("tracks");
    const addTrackBtnNode = document.getElementById("add-track-btn");
    addTrackBtnNode.addEventListener('click', () => addTrack());
    function addTrack(options) {
        const trackNode = templateTrackNode.cloneNode(true);
        trackNode.style.display = '';
        setupTrack(trackNode, options);
        tracksNode.appendChild(trackNode);
    }

    // Setup global controls
    const nextAllBtnNode = document.getElementById("nextall-btn");
    const pauseAllBtnNode = document.getElementById("pauseall-btn");
    const unpauseAllBtnNode = document.getElementById("unpauseall-btn");
    nextAllBtnNode.addEventListener('click', () => nextAllTracks());
    pauseAllBtnNode.addEventListener('click', () => pauseAllTracks());
    unpauseAllBtnNode.addEventListener('click', () => unpauseAllTracks());
    function nextAllTracks() {
        for (const player of players)
            if (player && player.onNext)
                player.onNext();
    }
    function pauseAllTracks() {
        for (const player of players)
            if (player && player.onPause)
                player.onPause();
    }
    function unpauseAllTracks() {
        for (const player of players)
            if (player && player.onUnpause)
                player.onUnpause();
    }

    // Setup volume updater
    setInterval(() => {
        for (const player of players)
            if (player && player.updateVolume)
                player.updateVolume();
    }, 50);

    // TODO: Load/save settings or put defaults
    addTrack({
        initialUrls: [
            "https://www.youtube.com/watch?v=2F6B9EibJjw",
            "https://www.youtube.com/watch?v=7JMvn0wfABQ",
            "https://www.youtube.com/watch?v=FjHGZj2IjBk",
            "https://www.youtube.com/watch?v=HXUy3EaVmXQ",
            "https://www.youtube.com/watch?v=ZkiMk2PUZQA",
            "https://www.youtube.com/watch?v=htnobkrtDoo",
            "https://www.youtube.com/watch?v=qj9NFFvJ7o4",
            "https://www.youtube.com/watch?v=lTRiuFIWV54",
        ],
    });
    addTrack({
        initialUrls: [
            "https://www.youtube.com/watch?v=8plwv25NYRo",
            "https://www.youtube.com/watch?v=mPZkdNFkNps",
            "https://www.youtube.com/watch?v=IMV3CHy9uzE",
            "https://www.youtube.com/watch?v=nDqP7kcr-sc",
            "https://www.youtube.com/watch?v=RqzGzwTY-6w",
            "https://www.youtube.com/watch?v=xNN7iTA57jM",
            "https://www.youtube.com/watch?v=eH-_GMhH-kk",
            "https://www.youtube.com/watch?v=CLKvhtS51us",
        ],
    });
}

function onYouTubeIframeAPIReady() {
    setupPage();
    document.documentElement.style.animationName = "darkblurry-fadein";
}

function showToast(message, className) {
    Toastify({
        text: message,
        gravity: 'bottom',
        position: 'left',
        duration: Math.min(3000 + (message.length * 60), 30000), // 200 w/m = ~1000c/m = ~16.6c/s = 0.06s/c = 60ms/c
        className: className ? ('toast-' + className) : undefined,
    }).showToast();
}

function getRandomInt(min, max) {
    // From: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
}

function unlerp(a, b, value) {
    return (value - a) / (b - a);
}