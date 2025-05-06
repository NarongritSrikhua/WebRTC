const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)
const { v4: uuidV4 } = require('uuid')

// Store room data
const roomData = new Map() // Store both captures and messages for each room

function initializeRoom(roomId) {
  if (!roomData.has(roomId)) {
    roomData.set(roomId, {
      captures: [],
      messages: []
    })
  }
  return roomData.get(roomId)
}

app.set('view engine', 'ejs')
app.use(express.static('public'))

app.get('/', (req, res) => {
  res.redirect(`/${uuidV4()}`)
})

app.get('/:room', (req, res) => {
  const roomId = req.params.room
  const room = initializeRoom(roomId)
  res.render('room', { 
    roomId: roomId,
    captures: room.captures,
    messages: room.messages
  })
})

io.on('connection', socket => {
  socket.on('join-room', (roomId, userId) => {
    const room = initializeRoom(roomId)
    
    socket.join(roomId)
    socket.to(roomId).broadcast.emit('user-connected', userId)

    // Send existing room data to new user
    socket.emit('initialize-room', {
      captures: room.captures,
      messages: room.messages
    })

    socket.on('disconnect', () => {
      socket.to(roomId).broadcast.emit('user-disconnected', userId)
    })
    
    socket.on('send-chat-message', data => {
      const messageData = {
        message: data.message,
        timestamp: new Date().toISOString()
      }
      
      // Store the message
      room.messages.push(messageData)

      // Broadcast to others in room
      socket.to(data.roomId).broadcast.emit('chat-message', messageData)
    })

    socket.on('image-captured', data => {
      const captureData = {
        imageData: data.imageData,
        label: data.label,
        timestamp: new Date().toISOString()
      }
      
      // Store the capture
      room.captures.push(captureData)

      // Broadcast to others in room
      socket.to(roomId).broadcast.emit('image-captured', captureData)
    })    
  })
})

server.listen(3000)
