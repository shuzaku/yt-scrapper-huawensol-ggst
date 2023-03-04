//controllers
var Player = require("../models/players");
var Character = require("../models/characters");
var Creator = require("../models/creators");
var Match = require("../models/matches");
var Video = require("../models/videos")
var ObjectId = require('mongodb').ObjectId;
var moment = require('moment'); // require

const express = require('express')
const bodyParser = require('body-parser')
const morgan = require('morgan')
const cors = require('cors')
var backup = require('mongodb-backup');

let dotenv = require('dotenv');
dotenv.config();
var connectionString  = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.vdh52.mongodb.net/Fighters-Edge?retryWrites=true&w=majority`;
var mongoose = require('mongoose');

const app = express()
app.use(morgan('combined'))
app.use(bodyParser.json())
app.use(cors())


mongoose.connect(connectionString);
var db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error"));
db.once("open", function () {
  console.log("Connection Succeeded");
  run();
});

app.listen(process.env.PORT || 8082);
var channel = {
      id: ObjectId('611b3f8d25adfa6a98e8ff2c'),
      youtubeId:'UCeZDSLbF1st_4fXtSzXVR5w',
      name: 'HUAWEN SOL',
      channelVideos: []
    }

var characterList = [];
var playerList = [];
var mongoGameId = '606d42021ddff92064798667';
// Fetch all players

function run(){
  getCharacters().then(()=>{
    getPlayers().then(()=>{
      getChannelInfo().then(()=>{
          getVideos(channel)
      })
    });
  })
}


function getVideos(channel) {
  var route = `https://www.googleapis.com/youtube/v3/search?key=AIzaSyCYRdDi_twi0Xq-4W70LJoargI63fI6ljg&channelId=${channel.youtubeId}&part=snippet,id&order=date&maxResults=50`
  const https = require('https');

  console.log('scrubbing channel...')
  https.get(route, (resp) => {
    let data = '';

    // A chunk of data has been received.
    resp.on('data', (chunk) => {
      data += chunk;
    });

    // The whole response has been received. Print out the result.
    resp.on('end', () => {
      data = JSON.parse(data);
      if(data){
        console.log(`youtube data retrieved: ${data.items.length} found`)
      }
      var mappedVideos = data.items.map(video =>  {
        if(video.id.kind === "youtube#video" && video.snippet.title.includes('vs')){
          return {
            id: video.id.videoId,
            title: video.snippet.title,
            player1: {
              id: getPlayer1Id(video.snippet.title.split("vs")[0]),
              characterId: getPlayer1CharacterId(video.snippet.title.split("vs")[0])
            },
            player2: {
              id: getPlayer2Id(video.snippet.title.split("vs")[1]),
              characterId: getPlayer2CharacterId(video.snippet.title.split("vs")[1])
            },
            videoUrl: video.id.videoId,
            gameId: ObjectId(mongoGameId),
            publishedAt: moment(video.snippet.publishedAt)
          }
        }
      });

      mappedVideos = mappedVideos.filter(v=>v);
      if(channel.updatedAt){
        mappedVideos = mappedVideos.filter(v => v.publishedAt.isAfter(channel.updatedAt));
      }
      mappedVideos = mappedVideos.filter(v => v.publishedAt.isAfter(channel.updatedAt));
      mappedVideos = mappedVideos.filter(v => v.player1.characterId && v.player2.characterId)
      console.log(`adding...${mappedVideos.length} videos` )
      if(mappedVideos.length > 0){
        postMatches(mappedVideos.reverse());
      }
    });

  }).on("error", (err) => {
    console.log("Error: " + err.message);
  });
}

function getChannelInfo() {
  console.log('getting channel info...')
  return new Promise((resolve, reject) => {
    Creator.find({YoutubeId: channel.youtubeId}, 'updatedAt ', function (error, contentCreator) {
      if (error) { console.error(error); }
        channel.updatedAt = moment(contentCreator[0].updatedAt)
        resolve();
      })
  })
};

function getCharacters() {
  console.log('getting characters...')
  return new Promise((resolve, reject) => {
    Character.find({}, 'Name GameId ', function (error, characters) {
      if (error) { console.error(error); }
        characterList =  characters
        resolve();
      })
  });
};

function getPlayers() {
  console.log('getting players...')
  return new Promise((resolve, reject) => {
    Player.find({}, 'Name ', function (error, players) {
      if (error) { console.error(error); }
        playerList =  players
        resolve();
      })
  });
};

function getPlayer1Id(title) {
  var start = title.indexOf('】') + 1;
  var end = (title.indexOf('('));
  var player1Name = title.slice(start,end);
  var playerId = getPlayerIdByName(player1Name);
  return playerId;
};

function getPlayer2Id(title) {
  var end = title.indexOf('(');
  var player1Name = title.slice(1 , end);
  var playerId = getPlayerIdByName(player1Name);
  return playerId;
};

function getPlayer1CharacterId(title){
  var start = title.indexOf('(')+1;
  var end = title.indexOf(')');
  var characterName = title.slice(start,end);
  var characterId = getCharacterIdByName(characterName);
  return characterId;
}

function getPlayer2CharacterId(title){
  var start = title.indexOf('(')+1;
  var end = title.indexOf(')');
  var characterName = title.slice(start,end);
  var characterId = getCharacterIdByName(characterName);
  return characterId;
}

function getPlayerIdByName(name) {
  var player = playerList.filter(p => p.Name.toLowerCase() === name.toLowerCase())[0];
  var playerId =  null;
  if(player){
    playerId = player._id;
  } else {
    addPlayer(name).then((id)=> {
      playerid = id;
    });
  }
  return playerId
}

function getCharacterIdByName(name) {
  console.log(name)
  var character = characterList.filter(c => c.GameId === mongoGameId && c.Name.toLowerCase().includes(name.toLowerCase()))[0];
  if(character){
    var characterId = character._id;
  }
  else {
    if(name === 'JACK-O'){
      var characterId = '612c2d1d3b6e7a7404e22d99'
    }
  }
  return characterId
}

function addPlayer(playerName){
  console.log(`creating player ${playerName}`)

  return new Promise((reject) => {
    var formattedName = playerName.replace(/ /g, '').replace('-','').replace('_','');
    var randomNumber = Math.floor(1000 + Math.random() * 9000);

    var slug  = `${formattedName.toLowerCase()}-${randomNumber}`;

    var new_player = new Player({
      Name: playerName,
      Slug: slug
    })

    new_player.save(function (error, player) {
        if (error) {
          console.log(error)
          reject();
        }
        return player._id
    })
  });
}

function postMatches (matches){
  var matches = matches.map(match =>{
    return new Match({
      VideoUrl: match.videoUrl,
      GameId: match.gameId,
      Team1Players: [
        {
          Slot:1,
          Id: ObjectId(match.player1.id),
          CharacterIds: [ObjectId(match.player1.characterId)],
        }
      ],
      Team2Players: [
        {
          Slot:2,
          Id: ObjectId(match.player2.id),
          CharacterIds: [ObjectId(match.player2.characterId)],
        }
      ],
      SubmittedBy: ObjectId('6314df6cc141db206893b6a7'),
      UpdatedBy: ObjectId('6314df6cc141db206893b6a7'),
    })
  })

  console.log(matches)
  
  matches = matches.filter(match => {
    var hasIds = match.Team1Players[0].Id && match.Team2Players[0].Id;
    var hasCharacterIds = match.Team1Players[0].CharacterIds.length > 0 && match.Team2Players[0].CharacterIds.length > 0
    return hasIds && hasCharacterIds
  })
  
  matches.sort((a, b) => moment(a.UpdatedBy).diff(moment(b.UpdatedBy)))
    sendMatches(matches).then( ()=>{
      postVideos(matches).then( ()=>{
         updateChannel(matches[matches.length-1].VideoUrl).then(()=>{
          console.log('Done...app')
        })
      })
    })
}

function sendMatches(matches){
  console.log(`saving matches`)
  return new Promise((resolve, reject) => {
    Match.insertMany(matches, function(error){
      if (error) {
        console.log(error)
        reject(); 
      }
      resolve();
    }); 
  });
}

function postVideos(matches){
  console.log(`saving videos `)
  return new Promise((resolve, reject) => {
    var videos = matches.map(match => {
      return {
        Url: match.VideoUrl,
        ContentType: "Match",
        VideoType: "youtube",
        GameId:  match.GameId,
        ContentCreatorId: channel.id
      }
    })

    Video.insertMany(videos, function(error,videos){
      if (error) {
        console.log(error);
        reject();
      }
      resolve();
    })    
  });
}

function updateChannel(videoUrl){
  console.log(`updating channel`)

  return new Promise((resolve, reject) => {
    Creator.findById(channel.id, 'Name YoutubeUrl YoutubeId LogoUrl LastVideoId', function (error, creator) {
      if (error) { console.error(error); }
        creator.LastVideoId = videoUrl;

        creator.save(function (error) {
          if (error) {
            console.log(error)
            reject();
          }
          resolve();
        })
    })
  }); 
}

// app.listen(process.env.PORT || 80);   

