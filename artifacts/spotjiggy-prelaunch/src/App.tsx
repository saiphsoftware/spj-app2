function Home() {
  return (
    <main className="prelaunch" aria-label="SpotJiggy coming soon">
      <div className="prelaunch-inner">
        <div className="brand-lockup" aria-label="SpotJiggy">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <rect x="3.5" y="3.5" width="10" height="10" rx="2.5" stroke="white" strokeWidth="2.5" />
              <rect x="18.5" y="3.5" width="10" height="10" rx="2.5" stroke="white" strokeWidth="2.5" />
              <rect x="3.5" y="18.5" width="10" height="10" rx="2.5" stroke="white" strokeWidth="2.5" />
              <rect x="18.5" y="18.5" width="10" height="10" rx="2.5" stroke="white" strokeWidth="2.5" />
            </svg>
          </span>
          <span className="brand-name">SpotJiggy</span>
        </div>
        <h1 className="coming-soon">Coming <span>soon</span></h1>
        <p className="product-description">
          Turn favorite pictures into puzzles. Share individual pieces, collect them, and complete
          the picture solo or with friends.
        </p>
        <div className="tile-orbit" aria-hidden="true">
          {Array.from({ length: 9 }, (_, index) => <i key={index} />)}
        </div>
      </div>
    </main>
  );
}

function App() { return <Home />; }

export default App;
