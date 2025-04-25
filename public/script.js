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
  captureVideo(myVideo, 'My Video')
})

captureRemoteBtn.addEventListener('click', () => {
  const remoteVideo = document.querySelector('#video-grid video:not(:first-child)')
  if (remoteVideo) {
    captureVideo(remoteVideo, 'Remote Video')
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

function addCaptureToGrid(imageData, label) {
  // Create container for the capture
  const container = document.createElement('div')
  container.className = 'capture-container'
  
  // Add label
  const labelElement = document.createElement('div')
  labelElement.className = 'capture-label'
  labelElement.textContent = `${label} - ${new Date().toLocaleTimeString()}`
  container.appendChild(labelElement)
  
  // Add captured image
  const img = document.createElement('img')
  img.src = imageData
  container.appendChild(img)
  
  // Add to captures grid
  capturesGrid.insertBefore(container, capturesGrid.firstChild)
}

// Listen for captures from other user
socket.on('image-captured', data => {
  addCaptureToGrid(data.imageData, data.label)
})
