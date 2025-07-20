const NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const OCTAVES = [4, 5];
const KEYBOARD_MAP = {
  'z': 'C4',  's': 'Db4', 'x': 'D4',  'd': 'Eb4', 'c': 'E4',  'v': 'F4',
  'g': 'Gb4', 'b': 'G4',  'h': 'Ab4', 'n': 'A4',  'j': 'Bb4', 'm': 'B4',
  'q': 'C5',  '2': 'Db5', 'w': 'D5',  '3': 'Eb5', 'e': 'E5',  'r': 'F5',
  '5': 'Gb5', 't': 'G5',  '6': 'Ab5', 'y': 'A5',  '7': 'Bb5', 'u': 'B5'
};

class Piano {
  constructor() {
  this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  this.gainNode = this.audioContext.createGain();

  this.destination = this.audioContext.createMediaStreamDestination();
  this.gainNode.connect(this.destination); 
  this.gainNode.connect(this.audioContext.destination); 
  this.mediaRecorder = new MediaRecorder(this.destination.stream);
  this.recordedChunks = [];

  this.mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      this.recordedChunks.push(e.data);
    }
  };

  this.mediaRecorder.onstop = () => {
    const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `piano-recording-${new Date().toISOString()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  this.activeNotes = new Map();
  this.initUI();
  this.initPianoKeys();
  this.initEventListeners();
}

  async loadSound(note) {
    try {
      const response = await fetch(`sounds/${note}.mp3`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      return audioBuffer;
    } catch (error) {
      console.error(`Error loading sound for ${note}:`, error);
      return null;
    }
  }

  initUI() {
    document.getElementById('volume').addEventListener('input', (e) => {
      this.gainNode.gain.value = parseFloat(e.target.value);
    });

    document.getElementById('record-btn').addEventListener('click', () => this.startRecording());
    document.getElementById('stop-btn').addEventListener('click', () => this.stopRecording());
    document.getElementById('download-btn').addEventListener('click', () => this.downloadNoteEvents());

    document.getElementById('theme-toggle').addEventListener('click', () => {
      document.body.classList.toggle('dark-theme');
    });
  }

  initPianoKeys() {
    const keyboard = document.getElementById('piano-keyboard');

    const flatMap = {
      'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb',
      'G#': 'Ab', 'A#': 'Bb'
    };

    OCTAVES.forEach(octave => {
      NOTES.forEach(note => {
        const whiteKey = document.createElement('div');
        whiteKey.className = 'piano-key white-key';
        whiteKey.dataset.note = `${note}${octave}`;
        whiteKey.innerHTML = `<span class="key-label">${note}${octave}</span>`;
        keyboard.appendChild(whiteKey);

        if (!['E', 'B'].includes(note)) {
          const sharp = `${note}#${octave}`;
          const flat = `${flatMap[`${note}#`]}${octave}`;
          const blackKey = document.createElement('div');
          blackKey.className = 'piano-key black-key';
          blackKey.dataset.note = flat;
          blackKey.innerHTML = `<span class="key-label">${flat}</span>`;
          keyboard.appendChild(blackKey);
        }
      });
    });
  }

  initEventListeners() {
    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const note = KEYBOARD_MAP[e.key.toLowerCase()];
      if (note) this.playNote(note);
    });

    document.addEventListener('keyup', (e) => {
      const note = KEYBOARD_MAP[e.key.toLowerCase()];
      if (note) this.stopNote(note);
    });

    const keyboard = document.getElementById('piano-keyboard');
    keyboard.addEventListener('mousedown', (e) => {
      const key = e.target.closest('.piano-key');
      if (key) this.playNote(key.dataset.note);
    });

    keyboard.addEventListener('mouseup', (e) => {
      const key = e.target.closest('.piano-key');
      if (key) this.stopNote(key.dataset.note);
    });

    keyboard.addEventListener('mouseleave', (e) => {
      const key = e.target.closest('.piano-key');
      if (key) this.stopNote(key.dataset.note);
    });
  }

  async playNote(note) {
    if (this.activeNotes.has(note)) return;

    const audioBuffer = await this.loadSound(note);
    if (!audioBuffer) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;

    const noteGain = this.audioContext.createGain();
    noteGain.connect(this.gainNode);
    source.connect(noteGain);

    source.start();
    this.activeNotes.set(note, { source, gain: noteGain });

    const key = document.querySelector(`.piano-key[data-note="${note}"]`);
    if (key) key.classList.add('active');

    if (this.isRecording) {
      this.recordedNotes.push({
        note,
        startTime: Date.now() - this.recordStartTime,
        type: 'noteOn'
      });
    }
  }

  stopNote(note) {
    const activeNote = this.activeNotes.get(note);
    if (!activeNote) return;

    const { gain } = activeNote;
    gain.gain.setValueAtTime(gain.gain.value, this.audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.1);

    setTimeout(() => {
      this.activeNotes.delete(note);
    }, 100);

    const key = document.querySelector(`.piano-key[data-note="${note}"]`);
    if (key) key.classList.remove('active');

    if (this.isRecording) {
      this.recordedNotes.push({
        note,
        startTime: Date.now() - this.recordStartTime,
        type: 'noteOff'
      });
    }
  }

startRecording() {
  this.recordedChunks = [];
  this.mediaRecorder.start();

  document.getElementById('record-btn').classList.add('recording');
  document.getElementById('record-btn').disabled = true;
  document.getElementById('stop-btn').disabled = false;
  
}

stopRecording() {
  this.mediaRecorder.stop();

  document.getElementById('record-btn').classList.remove('recording');
  document.getElementById('record-btn').disabled = false;
  document.getElementById('stop-btn').disabled = true;
  document.getElementById('download-btn').disabled = false;
}
  downloadNoteEvents() {
    const recording = JSON.stringify(this.recordedNotes, null, 2);
    const blob = new Blob([recording], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `piano-recording-${new Date().toISOString()}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Piano();
});
