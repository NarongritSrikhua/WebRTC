const socket = io('/')
const videoGrid = document.getElementById('video-grid')
const capturesGrid = document.getElementById('captures-grid')
const myPeer = new Peer(undefined, {
  host: '/',
  port: '3001'
})

const myVideo = document.createElement('video')
myVideo.muted = true
const peers = {}

// Add capture buttons
const captureLocalBtn = document.getElementById('captureLocal')
const captureRemoteBtn = document.getElementById('captureRemote')

navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {
  addVideoStream(myVideo, stream)

  myPeer.on('call', call => {
    call.answer(stream)
    const video = document.createElement('video')
    call.on('stream', userVideoStream => {
      addVideoStream(video, userVideoStream)
    })
  })

  socket.on('user-connected', userId => {
    connectToNewUser(userId, stream)
  })
})

socket.on('user-disconnected', userId => {
  if (peers[userId]) peers[userId].close()
})

myPeer.on('open', id => {
  socket.emit('join-room', ROOM_ID, id)
})

function connectToNewUser(userId, stream) {
  const call = myPeer.call(userId, stream)
  const video = document.createElement('video')
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream)
  })
  call.on('close', () => {
    video.remove()
  })

  peers[userId] = call
}

function addVideoStream(video, stream) {
  video.srcObject = stream
  video.addEventListener('loadedmetadata', () => {
    video.play()
  })
  videoGrid.append(video)
}

// Add capture functionality
captureLocalBtn.addEventListener('click', () => {
  captureVideo(myVideo, 'Capture 1')
})

captureRemoteBtn.addEventListener('click', () => {
  const remoteVideo = document.querySelector('#video-grid video:not(:first-child)')
  if (remoteVideo) {
    captureVideo(remoteVideo, 'Capture 2')
  } else {
    alert('No remote video found')
  }
})

function captureVideo(videoElement, label) {
  const canvas = document.createElement('canvas')
  canvas.width = videoElement.videoWidth
  canvas.height = videoElement.videoHeight
  canvas.getContext('2d').drawImage(videoElement, 0, 0)
  
  const imageData = canvas.toDataURL()
  
  // Add capture locally
  addCaptureToGrid(imageData, label)
  
  // Broadcast capture to other user in the room
  socket.emit('image-captured', {
    imageData: imageData,
    label: label,
    roomId: ROOM_ID
  })
}

function addCaptureToGrid(imageData, label, timestamp) {
  const container = document.createElement('div')
  container.className = 'capture-container'
  
  const labelElement = document.createElement('div')
  labelElement.className = 'capture-label'
  labelElement.textContent = `${label} - ${formatTimestamp(timestamp)}`
  container.appendChild(labelElement)
  
  const img = document.createElement('img')
  img.src = imageData
  container.appendChild(img)
  
  capturesGrid.insertBefore(container, capturesGrid.firstChild)
}

// Listen for captures from other user
socket.on('image-captured', data => {
  addCaptureToGrid(data.imageData, data.label, data.timestamp)
})

// Add this after other socket.on handlers
socket.on('existing-captures', captures => {
  // Clear existing captures first
  capturesGrid.innerHTML = ''
  
  // Add all existing captures
  captures.forEach(capture => {
    addCaptureToGrid(capture.imageData, capture.label, capture.timestamp)
  })
})

// Initialize with any existing captures
if (typeof INITIAL_CAPTURES !== 'undefined' && INITIAL_CAPTURES.length > 0) {
  INITIAL_CAPTURES.forEach(capture => {
    addCaptureToGrid(capture.imageData, capture.label, capture.timestamp)
  })
}

// Chat functionality
const chatInput = document.getElementById('chat-input')
const sendButton = document.getElementById('send-message')
const chatMessages = document.getElementById('chat-messages')

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleTimeString()
}

function addMessageToChat(message, timestamp, isSent) {
  const messageElement = document.createElement('div')
  messageElement.className = `message ${isSent ? 'sent' : 'received'}`
  
  const textSpan = document.createElement('span')
  textSpan.textContent = message
  
  const timeSpan = document.createElement('span')
  timeSpan.className = 'message-time'
  timeSpan.textContent = formatTimestamp(timestamp)
  
  messageElement.appendChild(textSpan)
  messageElement.appendChild(timeSpan)
  
  chatMessages.appendChild(messageElement)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

sendButton.addEventListener('click', sendMessage)
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage()
  }
})

function sendMessage() {
  const message = chatInput.value.trim()
  if (message) {
    const timestamp = new Date().toISOString()
    
    // Add message to local chat
    addMessageToChat(message, timestamp, true)
    
    // Send message to other users in room
    socket.emit('send-chat-message', {
      message: message,
      roomId: ROOM_ID
    })
    
    // Clear input
    chatInput.value = ''
  }
}

// Listen for chat messages from other users
socket.on('chat-message', data => {
  addMessageToChat(data.message, data.timestamp, false)
})

// Handle room initialization
socket.on('initialize-room', data => {
  // Clear existing content
  capturesGrid.innerHTML = ''
  chatMessages.innerHTML = ''
  
  // Add existing captures
  data.captures.forEach(capture => {
    addCaptureToGrid(capture.imageData, capture.label, capture.timestamp)
  })
  
  // Add existing messages
  data.messages.forEach(msg => {
    addMessageToChat(msg.message, msg.timestamp, false)
  })
})

// Initialize room with existing data
if (typeof INITIAL_ROOM_DATA !== 'undefined') {
  INITIAL_ROOM_DATA.captures.forEach(capture => {
    addCaptureToGrid(capture.imageData, capture.label, capture.timestamp)
  })
  
  INITIAL_ROOM_DATA.messages.forEach(msg => {
    addMessageToChat(msg.message, msg.timestamp, false)
  })
}
