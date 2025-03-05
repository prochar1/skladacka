import React, { useState, useEffect, useRef } from 'react';

const config = window.config;
const TOTAL_TIME = config.timeout; // celkový časový limit
const IMAGE_URL = config.imageUrl; // URL obrázku – nastavíte v config

const containerWidth = config.width;
const containerHeight = config.height;
const cellWidth = containerWidth / config.piecesCols; // 200
const cellHeight = containerHeight / config.piecesCols; // 200
const snapTolerance = 50; // tolerance v pixelech pro přichycování dílků

// Vygeneruje dílky s náhodnou pozicí
function generatePieces() {
  const pieces = [];
  let id = 0;
  // Výpočet okrajů pro rozmístění dílků (použijeme při disassemblingu)
  for (let row = 0; row < config.piecesCols; row++) {
    for (let col = 0; col < config.piecesCols; col++) {
      const correctPos = { x: col * cellWidth, y: row * cellHeight };
      // V tomto příkladu vytváříme 2 dílky na čtverec
      if ((row + col) % 2 === 0) {
        pieces.push({
          id: id++,
          cell: { row, col },
          type: 'A',
          correctPos: { ...correctPos },
          // Počáteční currentPos = správná pozice (sestavení obrázku)
          currentPos: { ...correctPos },
          snapped: false,
          dragOffset: null,
        });
        pieces.push({
          id: id++,
          cell: { row, col },
          type: 'B',
          correctPos: { ...correctPos },
          currentPos: { ...correctPos },
          snapped: false,
          dragOffset: null,
        });
      } else {
        pieces.push({
          id: id++,
          cell: { row, col },
          type: 'C',
          correctPos: { ...correctPos },
          currentPos: { ...correctPos },
          snapped: false,
          dragOffset: null,
        });
        pieces.push({
          id: id++,
          cell: { row, col },
          type: 'D',
          correctPos: { ...correctPos },
          currentPos: { ...correctPos },
          snapped: false,
          dragOffset: null,
        });
      }
    }
  }
  return pieces;
}

function App() {
  const [gamePhase, setGamePhase] = useState('showImage'); // 'showImage', 'playing', 'completed', 'failed'
  const [pieces, setPieces] = useState([]);
  const [timer, setTimer] = useState(TOTAL_TIME);
  const timerRef = useRef(null);
  const firstMove = useRef(false);
  // Stav pro ID aktuálně taženého dílku
  const [activePieceId, setActivePieceId] = useState(null);
  // Stav pro sledování maximálního z-indexu
  const [maxZIndex, setMaxZIndex] = useState(1);

  useEffect(() => {
    if (gamePhase === 'showImage') {
      const timeout = setTimeout(() => {
        // Inicializujeme dílky sestavené podle correctPos
        setPieces(generatePieces());
        // Přepneme hru do fáze "playing"
        setGamePhase('playing');
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [gamePhase]);

  // Po přechodu do fáze "playing" rozpustíme obrázek animací – nastavíme currentPos na náhodná místa.
  useEffect(() => {
    if (gamePhase === 'playing') {
      const offsetX = (window.innerWidth - containerWidth) / 2;
      const offsetY = (window.innerHeight - containerHeight) / 2;
      const scatterMinX = -offsetX;
      const scatterMinY = -offsetY;
      const scatterMaxX = containerWidth + offsetX - cellWidth;
      const scatterMaxY = containerHeight + offsetY - cellHeight;
      // Po 500ms spustíme animaci rozpadu
      setTimeout(() => {
        setPieces((prev) =>
          prev.map((p) => ({
            ...p,
            currentPos: {
              x: Math.random() * (scatterMaxX - scatterMinX) + scatterMinX,
              y: Math.random() * (scatterMaxY - scatterMinY) + scatterMinY,
            },
          }))
        );
      }, 500);
    }
  }, [gamePhase]);

  // Start timer only once after the first move has been made.
  useEffect(() => {
    if (gamePhase === 'playing' && firstMove.current && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            timerRef.current = null;
            setGamePhase('failed');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [gamePhase]);

  useEffect(() => {
    if (
      gamePhase === 'playing' &&
      pieces.length > 0 &&
      pieces.every((p) => p.snapped)
    ) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setGamePhase('completed');
    }
  }, [pieces, gamePhase]);

  // Při spuštění tažení si uložíme offset kliknutí.
  const handleDragStart = (e, id) => {
    if (!firstMove.current) {
      firstMove.current = true;
      if (gamePhase === 'playing' && !timerRef.current) {
        timerRef.current = setInterval(() => {
          setTimer((prev) => {
            if (prev <= 1) {
              clearInterval(timerRef.current);
              timerRef.current = null;
              setGamePhase('failed');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    // Vypočtěte odsazení herní plochy (kontejner je centrovaný)
    const offsetX = (window.innerWidth - containerWidth) / 2;
    const offsetY = (window.innerHeight - containerHeight) / 2;
    setPieces((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              dragOffset: {
                x: clientX - (offsetX + p.currentPos.x),
                y: clientY - (offsetY + p.currentPos.y),
              },
              zIndex: maxZIndex, // Přiřadíme maximální z-index
            }
          : p
      )
    );
    // Nastavíme ID aktivního dílku
    setActivePieceId(id);
    // Zvýšíme maximální z-index
    setMaxZIndex((prev) => prev + 1);
  };

  // Aktualizujeme pozici dílku při tažení.
  const handleDragMove = (e, id) => {
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    const offsetX = (window.innerWidth - containerWidth) / 2;
    const offsetY = (window.innerHeight - containerHeight) / 2;
    setPieces((prev) =>
      prev.map((p) => {
        if (p.id === id && !p.snapped && p.dragOffset) {
          // Spočítáme novou absolutní pozici
          let absX = clientX - p.dragOffset.x;
          let absY = clientY - p.dragOffset.y;
          // Ořízneme absolutní pozici, aby dílek byl úplně uvnitř okna
          absX = Math.max(0, Math.min(absX, window.innerWidth - cellWidth));
          absY = Math.max(0, Math.min(absY, window.innerHeight - cellHeight));
          // Přepočítáme relativní pozici pro herní plochu
          return {
            ...p,
            currentPos: {
              x: absX - offsetX,
              y: absY - offsetY,
            },
          };
        }
        return p;
      })
    );
  };

  // Upravte handleDragEnd, aby při špatném umístění nastavila error flag
  const handleDragEnd = (e, id) => {
    e.preventDefault();
    setPieces((prev) =>
      prev.map((p) => {
        if (p.id === id && !p.snapped) {
          const dx = p.currentPos.x - p.correctPos.x;
          const dy = p.currentPos.y - p.correctPos.y;
          if (Math.sqrt(dx * dx + dy * dy) < snapTolerance) {
            // Pokud je v toleranci, snapnutí proběhne okamžitě (bez animace)
            return {
              ...p,
              currentPos: { ...p.correctPos },
              snapped: true,
              dragOffset: null,
              instantSnap: true, // flag pro okamžité snapnutí bez animace
              zIndex: 0, // Vrátíme z-index na 0
            };
          } else {
            return {
              ...p,
              dragOffset: null,
              instantSnap: true,
            };
          }
        }
        return { ...p, dragOffset: null };
      })
    );

    // Po krátké prodlevě resetujeme flag instantSnap (např. 50ms), aby další pohyby již měly animaci
    setTimeout(() => {
      setPieces((prev) =>
        prev.map((p) => (p.id === id ? { ...p, instantSnap: false } : p))
      );
    }, 50);

    // Resetujeme ID aktivního dílku
    setActivePieceId(null);
  };

  const restartGame = () => {
    setGamePhase('showImage');
    setTimer(TOTAL_TIME);
    firstMove.current = false;
    clearInterval(timerRef.current);
    timerRef.current = null;
    setPieces([]);
    setActivePieceId(null); // Resetujeme ID aktivního dílku
    setMaxZIndex(1); // Resetujeme maximální z-index
  };

  return (
    <div
      style={{
        textAlign: 'center',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
      }}
    >
      {gamePhase === 'showImage' && (
        <div
          style={{
            width: containerWidth,
            height: containerHeight,
            margin: '0 auto',
            backgroundImage: `url(${IMAGE_URL})`,
            backgroundSize: 'cover',
          }}
        />
      )}

      {gamePhase === 'playing' && (
        <div
          id="image"
          style={{
            position: 'relative',
            width: containerWidth,
            height: containerHeight,
            margin: '0 auto',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: containerWidth,
              height: containerHeight,
              margin: '0 auto',
              backgroundImage: `url(${IMAGE_URL})`,
              backgroundSize: 'cover',
              opacity: 0.1,
            }}
          />
          {pieces.map((piece) => {
            const border = config.border || 5;
            const hyp = border * (1 + Math.sqrt(2));

            const clipPaths = {
              A: 'polygon(0 0, 100% 0, 0 100%)',
              B: 'polygon(100% 100%, 100% 0, 0 100%)',
              C: 'polygon(0 0, 100% 0, 100% 100%)',
              D: 'polygon(0 0, 0 100%, 100% 100%)',
            };

            const clipPathsBorder = {
              A: `polygon(${border}px ${border}px, calc(100% - ${hyp}px) ${border}px, ${border}px calc(100% - ${hyp}px))`,
              B: `polygon(calc(100% - ${border}px) calc(100% - ${border}px), ${hyp}px calc(100% - ${border}px), calc(100% - ${border}px) ${hyp}px)`,
              C: `polygon(${hyp}px ${border}px, calc(100% - ${border}px) ${border}px, calc(100% - ${border}px) calc(100% - ${hyp}px))`,
              D: `polygon(${border}px calc(100% - ${border}px), ${border}px ${hyp}px, calc(100% - ${hyp}px) calc(100% - ${border}px))`,
            };

            return (
              <div
                className={`piece piece-type-${piece.type}`}
                key={piece.id}
                style={{
                  position: 'absolute',
                  width: cellWidth,
                  height: cellHeight,
                  left: piece.currentPos.x,
                  top: piece.currentPos.y,
                  clipPath: clipPaths[piece.type],
                  touchAction: 'none',
                  cursor: 'grab',
                  transition:
                    piece.dragOffset || piece.instantSnap
                      ? 'none'
                      : 'left 1s ease, top 1s ease',
                  zIndex: piece.snapped ? 0 : piece.zIndex || 1,
                }}
                onMouseDown={(e) => handleDragStart(e, piece.id)}
                onTouchStart={(e) => handleDragStart(e, piece.id)}
                onMouseMove={(e) => handleDragMove(e, piece.id)}
                onTouchMove={(e) => handleDragMove(e, piece.id)}
                onMouseUp={(e) => handleDragEnd(e, piece.id)}
                onTouchEnd={(e) => handleDragEnd(e, piece.id)}
              >
                <div
                  className={piece.snapped ? 'ok' : ''}
                  style={{
                    position: 'absolute',
                    width: cellWidth,
                    height: cellHeight,
                    left: 0,
                    top: 0,
                    background: piece.snapped ? 'green' : 'black',
                    clipPath: 'inherit',
                    zIndex: -1,
                  }}
                ></div>

                <div
                  style={{
                    position: 'absolute',
                    width: cellWidth,
                    height: cellHeight,
                    left: 0,
                    top: 0,
                    backgroundImage: `url(${IMAGE_URL})`,
                    backgroundSize: `${containerWidth}px ${containerHeight}px`,
                    backgroundPosition: `-${piece.correctPos.x}px -${piece.correctPos.y}px`,
                    zIndex: 1,
                    clipPath: clipPathsBorder[piece.type],
                  }}
                ></div>
              </div>
            );
          })}
          <div
            style={{
              position: 'fixed',
              top: 10,
              right: 10,
            }}
          >
            Čas: {timer}s
          </div>
        </div>
      )}

      {gamePhase === 'completed' && (
        <div>
          <div
            style={{
              width: containerWidth,
              height: containerHeight,
              margin: '0 auto',
              backgroundImage: `url(${IMAGE_URL})`,
              backgroundSize: 'cover',
            }}
          />
          <p>{config.successMessage}</p>
          <button onClick={restartGame}>{config.repeatGameButton}</button>
        </div>
      )}

      {gamePhase === 'failed' && (
        <div>
          <p>{config.expireTimeoutMessage}</p>
          <button onClick={restartGame}>{config.repeatGameButton}</button>
        </div>
      )}
    </div>
  );
}

export default App;
