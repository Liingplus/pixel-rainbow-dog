
import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Modality } from "@google/genai";

// --- 8-bit 音频引擎 ---
class ChiptuneSynth {
  ctx: AudioContext | null = null;
  isPlaying: boolean = false;

  constructor() {
    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
    }
  }

  playNote(freq: number, start: number, duration: number, type: OscillatorType = 'square') {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type; 
    osc.frequency.setValueAtTime(freq, start);
    
    gain.gain.setValueAtTime(0.08, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(start);
    osc.stop(start + duration);
  }

  startBGM() {
    if (this.isPlaying || !this.ctx) return;
    this.isPlaying = true;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const happyBirthday = [
      [261.63, 0.4], [261.63, 0.2], [293.66, 0.6], [261.63, 0.6], [349.23, 0.6], [329.63, 1.2],
      [261.63, 0.4], [261.63, 0.2], [293.66, 0.6], [261.63, 0.6], [392.00, 0.6], [349.23, 1.2],
    ];

    const jingleBells = [
      [329.63, 0.3], [329.63, 0.3], [329.63, 0.6],
      [329.63, 0.3], [329.63, 0.3], [329.63, 0.6],
      [329.63, 0.3], [392.00, 0.3], [261.63, 0.45], [293.66, 0.15], [329.63, 0.6],
    ];

    const fullMelody = [...happyBirthday, ...jingleBells];
    
    let nextNoteTime = this.ctx.currentTime;
    const schedule = () => {
      if (!this.isPlaying || !this.ctx) return;
      
      while (nextNoteTime < this.ctx.currentTime + 0.1) {
        fullMelody.forEach(([freq, dur]) => {
          this.playNote(freq, nextNoteTime, dur * 0.8);
          nextNoteTime += dur;
        });
      }
      setTimeout(schedule, 1000);
    };

    schedule();
  }
}

const STORAGE_KEY = 'pixel_rainbow_dog_data';

const PixelChristmasTree = () => (
  <div className="tree-container">
    <div className="pixel-star"></div>
    <div className="branch b1"></div>
    <div className="branch b2"></div>
    <div className="branch b3"></div>
    <div className="tree-trunk"></div>
    <div className="tree-lights">
      {[...Array(5)].map((_, i) => <div key={i} className={`pixel-light l-${i}`}></div>)}
    </div>
  </div>
);

const App = () => {
  const [stage, setStage] = useState<'idle' | 'loading' | 'active'>('idle');
  const [dogImage, setDogImage] = useState<string | null>(null);
  const [error, setError] = useState<boolean>(false);
  const synthRef = useRef<ChiptuneSynth | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      setDogImage(savedData);
    }
  }, []);

  const processImage = (src: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = src;
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        const w = img.width;
        const h = img.height;
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const visited = new Uint8Array(w * h);
        const queue: [number, number][] = [];

        const refR = data[0], refG = data[1], refB = data[2];

        for (let x = 0; x < w; x++) queue.push([x, 0], [x, h - 1]);
        for (let y = 1; y < h - 1; y++) queue.push([0, y], [w - 1, y]);

        let head = 0;
        const threshold = 110;

        while (head < queue.length) {
          const [cx, cy] = queue[head++];
          const idx = cy * w + cx;
          if (visited[idx]) continue;
          const p = idx * 4;
          const diff = Math.abs(data[p] - refR) + Math.abs(data[p+1] - refG) + Math.abs(data[p+2] - refB);
          if (diff < threshold) {
            visited[idx] = 1;
            if (cx + 1 < w) queue.push([cx + 1, cy]);
            if (cx - 1 >= 0) queue.push([cx - 1, cy]);
            if (cy + 1 < h) queue.push([cx, cy + 1]);
            if (cy - 1 >= 0) queue.push([cx, cy - 1]);
          }
        }

        let minX = w, minY = h, maxX = 0, maxY = 0;
        let hasContent = false;
        for (let i = 0; i < w * h; i++) {
          if (visited[i]) data[i * 4 + 3] = 0;
          else {
            const x = i % w, y = Math.floor(i / w);
            minX = Math.min(minX, x); minY = Math.min(minY, y);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
            hasContent = true;
          }
        }

        if (!hasContent) resolve(src);
        else {
          const cropCanvas = document.createElement('canvas');
          cropCanvas.width = maxX - minX + 1; cropCanvas.height = maxY - minY + 1;
          ctx.putImageData(imageData, 0, 0);
          cropCanvas.getContext('2d')!.drawImage(canvas, minX, minY, cropCanvas.width, cropCanvas.height, 0, 0, cropCanvas.width, cropCanvas.height);
          const finalResult = cropCanvas.toDataURL('image/png');
          localStorage.setItem(STORAGE_KEY, finalResult);
          resolve(finalResult);
        }
      };
      img.onerror = () => resolve("");
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const result = await processImage(event.target?.result as string);
        setDogImage(result);
        setError(false);
        setStage('active');
        if (!synthRef.current) {
          synthRef.current = new ChiptuneSynth();
          synthRef.current.startBGM();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const startSurprise = async () => {
    if (!synthRef.current) {
      synthRef.current = new ChiptuneSynth();
      synthRef.current.startBGM();
    }

    if (dogImage) {
      setStage('active');
      return;
    }

    setStage('loading');
    const presetImg = new Image();
    presetImg.src = `/image.png?t=${Date.now()}`;
    presetImg.onload = async () => {
      const result = await processImage(presetImg.src);
      if (result) {
        setDogImage(result);
        setStage('active');
      } else {
        setError(true);
        setStage('active');
      }
    };
    presetImg.onerror = () => {
      setTimeout(() => { setError(true); setStage('active'); }, 1000);
    };
  };

  const clearMemory = () => {
    localStorage.removeItem(STORAGE_KEY);
    setDogImage(null);
    setError(true);
  };

  return (
    <div className="app-container">
      {stage === 'idle' && (
        <div className="hero">
          <div className="gift-box" onClick={startSurprise}>🎁</div>
          <button className="pixel-btn" onClick={startSurprise}>
            {dogImage ? '进入圣诞空间' : '启动系统'}
          </button>
        </div>
      )}

      {stage === 'loading' && (
        <div className="hero loader">
          <div className="pixel-text">同步像素记忆...</div>
          <div className="progress-bar"><div className="fill"></div></div>
        </div>
      )}

      {stage === 'active' && (
        <>
          <div className="stars-bg"></div>
          <div className="scanlines"></div>
          
          <div className="greeting-text">
            CHIPTUNE PARTY<br/>
            <span>HAPPY BIRTHDAY TWJ</span>
          </div>

          <PixelChristmasTree />

          {error && !dogImage ? (
            <div className="error-overlay">
              <div className="pixel-text" style={{fontSize: '10px', marginBottom: '10px'}}>请提供狗狗素材</div>
              <button className="pixel-btn upload-btn" onClick={() => fileInputRef.current?.click()}>
                上传图片
              </button>
              <input type="file" ref={fileInputRef} style={{display: 'none'}} accept="image/*" onChange={handleFileUpload} />
            </div>
          ) : (
            dogImage && (
              <>
                <div className="dog-track">
                  <div className="dog-container">
                    <div className="dog-bubble">Twj生日快乐！</div>
                    <img src={dogImage} className="pixel-dog" alt="rainbow-dog" />
                  </div>
                </div>
                <button 
                  className="pixel-btn reset-btn" 
                  onClick={(e) => { e.stopPropagation(); clearMemory(); }}
                >
                  重置
                </button>
              </>
            )
          )}
        </>
      )}
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}
