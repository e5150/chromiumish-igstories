var API_BASE = "https://i.instagram.com/api/v1/";
var FEED_API = API_BASE + "feed/";
var EXPLORE_API = API_BASE + "discover/explore/";
var INSTAGRAM_FEED_CLASS_NAME = "_qj7yb";
var INSTAGRAM_EXPLORE_FEED_CLASS_NAME = "_oyz6j";
var INSTAGRAM_USER_IMAGE_CLASS_NAME = "_8gpiy _r43r5";

// BEGIN INJECTION
injectPswpContainer();
loadStories();

// listen for background.js to send over cookies so we are clear to make requests
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    var instagramCookies = JSON.parse(request.instagramCookies);    
    // only fetch stories if the cookies are available
    if((instagramCookies.ds_user_id && instagramCookies.sessionid)) {
      var instagramFeed = document.getElementsByClassName(INSTAGRAM_FEED_CLASS_NAME)[0];
      var instagramExploreFeed = document.getElementsByClassName(INSTAGRAM_EXPLORE_FEED_CLASS_NAME)[0];
      var instagramUserImage = document.getElementsByClassName(INSTAGRAM_USER_IMAGE_CLASS_NAME)[0];
      if(instagramFeed) {
        // only fetch and inject stories if the stories haven't already been injected
        if(!document.getElementById("trayContainer")) {
          getStories(instagramFeed);
        }
      }
      if(instagramExploreFeed) {
        // only fetch and inject stories if the stories haven't already been injected
        if(!document.getElementById("trayContainer")) {
          getExploreStories(instagramExploreFeed);
        }
      }
      if(instagramUserImage) {
        if(!$(instagramUserImage).hasClass("instagramUserImage")) {
          getUserStory(instagramUserImage);
        }
      }
    } 
  });

// tell background.js to load cookies so we can check if they are available before we make requests
function loadStories() {
  chrome.runtime.sendMessage('loadStories');
}

// fetch user's Story and inject it into their profile page if it's available
function getUserStory(instagramUserImage) {
  // sharedData is a window variable from Instagram that contains information about the current page
  var sharedData = JSON.parse($('html')[0].outerHTML.split("window._sharedData = ")[1].split(";</script>")[0]);
  var entryData = sharedData['entry_data'];
  var userId;
  
  /*
  * sharedData contains 'ProfilePage' if a user's profile page was loaded by its URL
  * if you click on a profile from the main Instagram feed or from search, an AJAX request will load the profile
  * and sharedData will still contain 'FeedPage', not 'ProfilePage'. 
  */
  if(entryData['ProfilePage']) {
    userId = entryData['ProfilePage'][0]['user']['id'];
  } else if(entryData['FeedPage']) {
    userId = entryData['FeedPage'][0]['feed']['media']['nodes'][0]['owner']['id'];
    // refresh the page so we get ProfilePage from sharedData; FeedPage sharedData doesn't have the user's ID 
    // TODO: figure out way to get user's ID when loading user profile from AJAX 
    chrome.runtime.sendMessage('refreshPage');
  }
  
  return getStory(userId).then(function(story) {
    if(story.items.length > 0) {
      $(instagramUserImage).addClass('unseenStoryItem');
      $(instagramUserImage).addClass('instagramUserImage');
      
      instagramUserImage.addEventListener("click", function() {
        showImageGallery(story.items);
      });
      
      // right click context menu for downloading Story
      $(function() {
        $.contextMenu({
          selector: '.instagramUserImage', 
          callback: function(key, options) {
            downloadStory(story);
          },
          items: {
            "download": {name: "Download Story"}
          }
        });
      });
    }
  }, function(error) {
    console.log("Error loading Story for user: " + JSON.stringify(error));
  });
}

// ping Instagram API for new Stories in tray
function getStories(instagramFeed) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", FEED_API + "reels_tray/", true);
  xhr.withCredentials = true;
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      if(xhr.status == 200) {
        injectStoryTray(JSON.parse(xhr.responseText), instagramFeed);
      }
    }
  }
  xhr.send();
}

// ping Instagram API for new Explore Stories in tray
function getExploreStories(instagramExploreFeed) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", EXPLORE_API, true);
  xhr.withCredentials = true;
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      if(xhr.status == 200) {
        injectStoryTray(JSON.parse(xhr.responseText)["items"][0]["stories"], instagramExploreFeed);
      }
    }
  }
  xhr.send();
}

// ping Instagram API for a specific user's Story
function getStory(userId) {
  return new Promise(function(resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", FEED_API + "user/" + userId + "/reel_media/", true);
    xhr.withCredentials = true;
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        if(xhr.status == 200) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(xhr.statusText);
        }
      } 
    }
    xhr.send();
  });
}

// inject div container to host the Story image gallery
function injectPswpContainer() {
  var pswpContainer = document.createElement("div");
  pswpContainer.setAttribute("id", "pswpContainer");
  document.body.appendChild(pswpContainer);
}

// inject Instagram Stories tray above the main Instagram feed
function injectStoryTray(response, instagramFeed) {
  var trayContainer = document.createElement("div");
  trayContainer.setAttribute("id", "trayContainer");
  
  var tray = response["tray"];
  
  // iterate through every friend
  for(var i = 0; i < tray.length; i++) {
    
    var trayItem = tray[i];
    
    (function(trayItem) {
      
      var user = trayItem['user'];
      var picture = user['profile_pic_url'];
      
      var trayItemContainer = document.createElement('div');
      trayItemContainer.style.display = 'inline-flex';
      trayItemContainer.style.marginLeft = '5px';
      trayItemContainer.style.marginRight = '5px';
      trayItemContainer.style.marginBottom = '15px';
      
      var trayItemImage = document.createElement('img');
      trayItemImage.setAttribute("id", "trayItemImage" + i);
      trayItemImage.width = 64;
      trayItemImage.height = 64;
      trayItemImage.style.margin = 'auto';
      trayItemImage.setAttribute("class", ((trayItem.items) ? "unseenStoryItem" : "seenStoryItem") + " trayItemImage");
      if(instagramFeed.className === INSTAGRAM_EXPLORE_FEED_CLASS_NAME) {
        // always show new Stories as available for Explore Stories since the trayItem doesn't contain the 'items' array
        trayItemImage.setAttribute("class", "unseenStoryItem trayItemImage");
      }
      trayItemImage.src = picture.replace("http://", "https://");
      trayItemImage.title = user.username;
      
      trayItemImage.addEventListener("click", function() {
        if(trayItem.items) {
          // if there are new Story images available, show them in the gallery
          showImageGallery(trayItem.items);
        } else {
          // retrieve the user's Story and show them in the gallery
          return getStory(trayItem.id).then(function(story) {
            showImageGallery(story.items);
          }, function(error) {
            alert("There was an error trying to load this person's Story.");
            console.log("Error loading Story for user: " + JSON.stringify(error));
          });
        }
      });
      
      var trayItemUsername = document.createElement('span');
      
      // to avoid overflow
      trayItemUsername.textContent = user.username.substr(0, 10) + (user.username.length > 10 ? '…' : '');
      trayItemUsername.style.marginTop = '10px';
      trayItemUsername.style.fontSize = '14px';

      if(trayItem.items) {
        trayItemUsername.style.color = '#262626';
      } else {
        trayItemUsername.style.color = '#a0a0a0';
      }
      
      trayItemContainer.appendChild(trayItemImage);
      trayItemContainer.appendChild(trayItemUsername);
      
      // right click context menu for downloading Story
      (function(i) {
        $(function() {
          $.contextMenu({
            selector: '#trayItemImage' + i, 
            callback: function(key, options) {
              if(trayItem.items) {
                // if there are new Story images available, download them
                downloadStory(trayItem);
              } else {
                // retrieve the user's Story and download it
                return getStory(trayItem.id).then(function(story) {
                  downloadStory(story);
                }, function(error) {
                  alert("There was an error trying to download this person's Story.");
                  console.log("Error downloading Story for user: " + JSON.stringify(error));
                });
              }    
            },
            items: {
              "download": {name: "Download Story"}
            }
          });
          
        });
      })(i);
      
      trayContainer.appendChild(trayItemContainer);
      
    })(trayItem);
    
  }
  
  // inject Story tray above Instagram feed
  if(!document.getElementById("trayContainer")) {
    instagramFeed.insertBefore(trayContainer, instagramFeed.childNodes[0]);
  }
}

// downloads a zip file containing the user's Story
function downloadStory(trayItem) {
  var zip = new JSZip();
  trayItem.items.map((storyItem, i) => {
    var mediaItemUrl = getMediaItemUrl(storyItem);
    // downloads each Story image/video and adds it to the zip file
    zip.file(getStoryFileName(storyItem, mediaItemUrl), urlToPromise(mediaItemUrl), {binary:true});
  });
  // generate zip file and start download
  zip.generateAsync({type:"blob"})
  .then(function(content) {
    saveAs(content, getZipFileName(trayItem));
  });
}

// promises to download the file before zipping it
function urlToPromise(url) {
  return new Promise(function(resolve, reject) {
    JSZipUtils.getBinaryContent(url, function (err, data) {
      if(err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

// returns the name of the zip file to download with format: (username-timestamp.zip)
function getZipFileName(trayItem) {
  return trayItem.user.username + "-" + moment().format() + ".zip";
}

// returns the name of the image/video file to add to the zip file
function getStoryFileName(storyItem, mediaItemUrl) {
  return storyItem['id'] + (((mediaItemUrl.includes(".mp4")) ? ".mp4" : ".jpg"));
}

// returns an optimized URL format for the image/video
function getMediaItemUrl(storyItem) {
  var mediaItem;
  if(storyItem['video_versions']) {
    mediaItem = storyItem['video_versions'][0];
  } else {
    mediaItem = storyItem['image_versions2']['candidates'][0];
  }
  var secureUrl = mediaItem['url'].replace("http://", "https://");
  return secureUrl.split("?")[0]; // leave out ig_cache_key
}

// used to initialize and show the Story image gallery
function getPswpElement(callback) {
  // if photoswipe element exists, return it
  if($('#pswp').length) {
    callback(document.getElementById('pswp'));
  } else {
    // photoswipe element doesn't exist, inject it
    $("#pswpContainer").load(chrome.extension.getURL("html/photoswipe.html"), function() {
      callback(document.getElementById('pswp'));
    });
  }
}

// displays image gallery for Story images
function showImageGallery(storyItems) {
  
  // retrieve the injected pswpElement
  getPswpElement(function(pswpElement) {
    var slides = [];
    
    storyItems.map((storyItem, i) => {
      // if videos are available, create a new HTML slide containing the Story video
      if(storyItem['video_versions']) {
        var video = storyItem['video_versions'][0];
        
        var storyVideo = document.createElement('video');
        var source = document.createElement("source");
        storyVideo.setAttribute("controls", true);
        if(i === 0) { storyVideo.setAttribute("autoplay", true); }
        source.src = video['url'];
        storyVideo.appendChild(source);
        $(storyVideo).addClass('videoStoryItem');
        $(storyVideo).addClass('pswp__video active');
        $(storyVideo).css('position', 'absolute');
        
        slides.push({
          html: storyVideo,
          storyItem: storyItem
        });
      } else {
        // create a normal slide with the Story image
        var image = storyItem['image_versions2']['candidates'][0];
        var url = image['url'].replace("http://", "https://");
        slides.push({
          src: url,
          msrc: url,
          w: image['width'],
          h: image['height'],
          storyItem: storyItem
        });
      }
    });
    
    var options = {
      closeOnScroll: false,
      shareEl: false
    };
    
    var gallery = new PhotoSwipe(pswpElement, PhotoSwipeUI_Default, slides, options);
    
    // update the Story author's username and profile picture
    gallery.listen('afterChange', function() {
      
      var currItem = $(gallery.currItem.container);
      
      var storyAuthorImage = currItem.find('.storyAuthorImage');
      var storyAuthorUsername = currItem.find('.storyAuthorUsername');
      
      // only add the Story author's username/profile picture to the current slide if it doesn't already exist
      if(storyAuthorImage.length == 0 && storyAuthorUsername.length == 0) {
        storyAuthorImage = document.createElement('img');
        storyAuthorImage.setAttribute("class", "storyAuthorImage");
        storyAuthorImage.style.position = 'absolute';
        
        storyAuthorUsername = document.createElement('span');
        storyAuthorUsername.setAttribute("class", "storyAuthorUsername");
        storyAuthorUsername.style.position = 'absolute';
        
        $(currItem).append(storyAuthorImage);
        $(currItem).append(storyAuthorUsername);
      }

      $(storyAuthorImage).attr("src", gallery.currItem.storyItem['user']['profile_pic_url']);
      $(storyAuthorUsername).text(gallery.currItem.storyItem['user']['username'] + " - " + moment.unix(gallery.currItem.storyItem['taken_at']).fromNow());
      
      if(gallery.currItem.storyItem['video_versions']) {
        $(storyAuthorImage).css("top", "45px");
        $(storyAuthorUsername).css("top", "55px");
      }
      
    });
    
    // handle playing/pausing videos while traversing the gallery
    gallery.listen('beforeChange', function() {
      var currItem = $(gallery.currItem.container);
      // remove 'active' class from any videos
      $('.pswp__video').removeClass('active');
      // add 'active' class to the currently playing video
      var currItemIframe = currItem.find('.pswp__video').addClass('active');
      // for each video, pause any inactive videos, and play the active video
      $('.pswp__video').each(function() {
        if (!$(this).hasClass('active')) {
          $(this)[0].pause();
          $(this)[0].currentTime = 0;
        } else {
          $(this)[0].play();
        }
      });
    });
    
    // handle pausing videos when the galley is closed
    gallery.listen('close', function() {
      $('.pswp__video').each(function() {
        $(this)[0].pause();
      });
    });
    
    gallery.init();
    
  });
  
}
