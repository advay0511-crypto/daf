import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  ArrowRight,
  BookOpen,
  CloudRain,
  Compass,
  Eye,
  Loader2,
  MapPin,
  Search,
  Sprout,
  Sun,
  ZoomOut,
} from 'lucide-react';
import hotspotsJson from '../../data/plantHotspots.json';
import cropsJson from '../../data/crops.json';
import {
  CropEntry,
  GrowthStageKey,
  PlaceSelection,
  PlantHotspot,
  SeasonKey,
} from '../../types';
import { reverseGeocode, searchPlaces } from '../../services/geocode';
import { fetchNasaPowerRecent30Days } from '../../services/nasaPower';
import { useToast } from '../Toast';
import { PlantModeToggle } from '../plantmode/PlantModeToggle';
import { PlantProfilePanel } from '../plantmode/PlantProfilePanel';
import { PlantGuideDrawer } from '../plantmode/PlantGuideDrawer';
import { FarmFallbackSVG } from '../plantmode/FarmFallbackSVG';
import { Terrain } from './Terrain';
import { Sky } from './Sky';
import { Structures } from './Structures';
import { CropFields } from './CropFields';
import { Trees } from './Trees';
import { NatureAndAnimals } from './NatureAndAnimals';
import { DayNight, computeLightingFromHour } from './DayNight';
import { WeatherFX } from './WeatherFX';
import { CameraRig } from './CameraRig';
import { detectSoftwareWebGL, isWebGLAvailable } from './worldMath';

const HOTSPOTS = hotspotsJson as PlantHotspot[];
const CROPS = cropsJson as CropEntry[];

const DEFAULT_FARM_LOCATION: PlaceSelection = {
  name: 'Shenandoah Valley, Virginia',
  displayName: 'Shenandoah Valley Farmstead, Virginia, United States',
  lat: 38.4496,
  lon: -78.8689,
  country: 'United States',
};

function formatClockHour(hour: number): string {
  const h = Math.floor(((hour % 24) + 24) % 24);
  const m = Math.floor((hour % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Local RoomEnvironment PMREM IBL — zero external HDR fetches */
const LocalEnvironment: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const { gl, scene } = useThree();
  useEffect(() => {
    if (!enabled) {
      scene.environment = null;
      return;
    }
    const pmrem = new THREE.PMREMGenerator(gl);
    const roomEnv = new RoomEnvironment();
    const rt = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = rt.texture;
    return () => {
      scene.environment = null;
      rt.dispose();
      roomEnv.dispose();
      pmrem.dispose();
    };
  }, [enabled, gl, scene]);
  return null;
};

/** Adaptive FPS watcher: lowers detail if average FPS < 24 in first few seconds */
const AdaptivePerfMonitor: React.FC<{ onLowPerf: () => void }> = ({ onLowPerf }) => {
  const framesRef = useRef(0);
  const elapsedRef = useRef(0);
  const triggeredRef = useRef(false);

  useFrame((_, delta) => {
    if (triggeredRef.current) return;
    framesRef.current += 1;
    elapsedRef.current += delta;
    if (elapsedRef.current >= 3.5) {
      const avgFps = framesRef.current / elapsedRef.current;
      if (avgFps < 24) {
        triggeredRef.current = true;
        onLowPerf();
      } else {
        // Keep watching cleanly every 4s
        framesRef.current = 0;
        elapsedRef.current = 0;
      }
    }
  });
  return null;
};

export const FarmScene: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const stageRef = useRef<HTMLDivElement | null>(null);

  const cropsById = useMemo(() => {
    const map: Record<string, CropEntry> = {};
    for (const c of CROPS) map[c.id] = c;
    return map;
  }, []);

  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  );
  const [isTouchDevice, setIsTouchDevice] = useState(
    () =>
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // WebGL & progressive readiness state
  const [webglOk, setWebglOk] = useState(() => isWebGLAvailable());
  const [sceneReady, setSceneReady] = useState(false);
  const [isSoftwareGl, setIsSoftwareGl] = useState(false);
  const [lowQuality, setLowQuality] = useState(false);

  // Search / location state
  const [selectedPlace, setSelectedPlace] = useState<PlaceSelection>(DEFAULT_FARM_LOCATION);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSelection[]>([]);
  const [searching, setSearching] = useState(false);
  const [locatingMe, setLocatingMe] = useState(false);
  const debounceRef = useRef<number | null>(null);

  // Interactive plant selection, stages, & tree seasons
  const [selectedHotspot, setSelectedHotspot] = useState<PlantHotspot | null>(null);
  const [focusedHotspotId, setFocusedHotspotId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [treeSeasons, setTreeSeasons] = useState<Record<string, SeasonKey>>({
    'red-maple': 'autumn',
  });
  const [cropStages, setCropStages] = useState<Record<string, GrowthStageKey>>({
    maize: 'harvest',
    wheat: 'harvest',
    sunflowers: 'flowering',
    tomatoes: 'harvest',
    pumpkins: 'harvest',
    carrots: 'harvest',
    lavender: 'flowering',
    strawberries: 'harvest',
    rice: 'vegetative',
  });
  const highlightTimerRef = useRef<number | null>(null);

  // Time-of-day slider (defaults to real local clock hour)
  const [timeHour, setTimeHour] = useState<number>(() => {
    const now = new Date();
    return Number((now.getHours() + now.getMinutes() / 60).toFixed(2));
  });

  // Live NASA Weather toggle
  const [weatherEnabled, setWeatherEnabled] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [rainFactor, setRainFactor] = useState(0);
  const [drynessFactor, setDrynessFactor] = useState(0);
  const [weatherSummary, setWeatherSummary] = useState<string | null>(null);

  const lighting = useMemo(() => computeLightingFromHour(timeHour), [timeHour]);

  // Fetch NASA POWER weather conditions when toggled ON or location changes while ON
  useEffect(() => {
    if (!weatherEnabled) {
      setRainFactor(0);
      setDrynessFactor(0);
      setWeatherSummary(null);
      return;
    }
    let cancelled = false;
    setWeatherLoading(true);
    fetchNasaPowerRecent30Days(selectedPlace.lat, selectedPlace.lon)
      .then((res) => {
        if (cancelled) return;
        const meanPrecip = res.meanPrecipMm ?? 0;
        const meanTmax = res.meanMaxC ?? 22;
        if (meanPrecip >= 2.2) {
          setRainFactor(Math.min(1, (meanPrecip - 1.2) / 5));
          setDrynessFactor(0);
          setWeatherSummary(`Rainy (${meanPrecip.toFixed(1)} mm/d)`);
        } else if (meanTmax >= 28 && meanPrecip < 1.2) {
          setRainFactor(0);
          setDrynessFactor(Math.min(1, (meanTmax - 26) / 10));
          setWeatherSummary(`Hot & Dry (${meanTmax.toFixed(0)}°C)`);
        } else {
          setRainFactor(0);
          setDrynessFactor(0);
          setWeatherSummary(`Mild (${meanTmax.toFixed(0)}°C)`);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWeatherSummary('Weather unavailable');
        }
      })
      .finally(() => {
        if (!cancelled) setWeatherLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [weatherEnabled, selectedPlace.lat, selectedPlace.lon]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSelectHotspotById = useCallback((id: string) => {
    const found = HOTSPOTS.find((h) => h.id === id);
    if (found) {
      setSelectedHotspot(found);
      setFocusedHotspotId(found.id);
    }
  }, []);

  // Keyboard support inside the 3D Valley stage (Tab cycles plants, Enter opens, Esc closes)
  const handleStageKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    if (e.key === 'Escape') {
      setSelectedHotspot(null);
      setFocusedHotspotId(null);
      return;
    }

    if (e.key === 'Tab' && target === stageRef.current) {
      e.preventDefault();
      const idx = focusedHotspotId
        ? HOTSPOTS.findIndex((h) => h.id === focusedHotspotId)
        : -1;
      const nextIdx = e.shiftKey
        ? (idx - 1 + HOTSPOTS.length) % HOTSPOTS.length
        : (idx + 1) % HOTSPOTS.length;
      setFocusedHotspotId(HOTSPOTS[nextIdx].id);
    }

    if (e.key === 'Enter' && focusedHotspotId && target === stageRef.current) {
      e.preventDefault();
      handleSelectHotspotById(focusedHotspotId);
    }
  };

  const handleSearchInput = (val: string) => {
    setSearchQuery(val);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (val.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchPlaces(val);
        setSuggestions(res);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 800);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.', 'error');
      return;
    }
    setLocatingMe(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const place = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setSelectedPlace(place);
        setSearchQuery(place.name);
        setSuggestions([]);
        setLocatingMe(false);
        showToast(`Field location set to ${place.name}`, 'success');
      },
      () => {
        setLocatingMe(false);
        showToast('Could not detect location. Search a town or region instead.', 'error');
      },
      { timeout: 8000 }
    );
  };

  const handleCheckField = async (e?: React.FormEvent) => {
    e?.preventDefault();
    let target = selectedPlace;
    if (searchQuery.trim().length >= 2 && searchQuery.trim() !== selectedPlace.name) {
      setSearching(true);
      try {
        const res = await searchPlaces(searchQuery);
        if (res.length > 0) {
          target = res[0];
          setSelectedPlace(res[0]);
        }
      } catch {
        // fallback to current selectedPlace
      } finally {
        setSearching(false);
      }
    }
    const sp = new URLSearchParams({
      name: target.name,
      display: target.displayName,
      lat: target.lat.toFixed(4),
      lon: target.lon.toFixed(4),
      activity: 'farming',
    });
    navigate(`/analyze?${sp.toString()}`);
  };

  const triggerShowAllPlants = () => {
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    setShowAll(true);
    highlightTimerRef.current = window.setTimeout(() => {
      setShowAll(false);
    }, 3000);
  };

  const activeCrop = selectedHotspot ? cropsById[selectedHotspot.cropId] ?? null : null;

  return (
    <section
      ref={stageRef}
      tabIndex={0}
      onKeyDown={handleStageKeyDown}
      aria-label="Interactive 3D Plant Mode Farm Valley — press Tab to cycle plants and Enter to open"
      className="relative w-full h-screen min-h-[680px] overflow-hidden bg-[#1F2E1A] select-none focus:outline-none"
    >
      {/* 3D Interactive Farm Valley OR Non-WebGL SVG Fallback */}
      {webglOk ? (
        <div className="absolute inset-0">
          <Canvas
            shadows={!isSoftwareGl && !lowQuality}
            dpr={[1, 2]}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
            camera={{ fov: 44, near: 0.3, far: 180, position: [0.5, 13.5, 22.8] }}
            onCreated={({ gl }) => {
              const rawCtx = gl.getContext();
              if (detectSoftwareWebGL(rawCtx)) {
                setIsSoftwareGl(true);
              }
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.05;
              const canvas = gl.domElement;
              canvas.addEventListener('webglcontextlost', (ev) => {
                ev.preventDefault();
                setWebglOk(false);
              });
              setSceneReady(true);
            }}
          >
            <LocalEnvironment enabled={!isSoftwareGl} />
            <AdaptivePerfMonitor onLowPerf={() => setLowQuality(true)} />

            <DayNight
              lighting={lighting}
              isMobile={isMobile}
              isSoftwareGl={isSoftwareGl}
              lowQuality={lowQuality}
            />

            <Sky
              sunDir={lighting.sunDir}
              topColor={lighting.topColor}
              horizonColor={lighting.horizonColor}
              sunColor={lighting.sunColor}
              nightAmount={lighting.nightAmount}
              sunsetAmount={lighting.sunsetAmount}
              reducedMotion={reducedMotion}
            />

            <Terrain
              drynessFactor={drynessFactor}
              rainFactor={rainFactor}
              selectedId={selectedHotspot?.id ?? null}
              focusedId={focusedHotspotId}
              showAll={showAll}
              isTouchDevice={isTouchDevice}
              reducedMotion={reducedMotion}
              onSelect={handleSelectHotspotById}
            />

            <Structures
              nightAmount={lighting.nightAmount}
              rainFactor={rainFactor}
              sunDir={lighting.sunDir}
              sunColor={lighting.sunColor}
              skyHorizonColor={lighting.horizonColor}
              selectedId={selectedHotspot?.id ?? null}
              focusedId={focusedHotspotId}
              showAll={showAll}
              isTouchDevice={isTouchDevice}
              reducedMotion={reducedMotion}
              onSelect={handleSelectHotspotById}
            />

            <CropFields
              cropStages={cropStages}
              sunDir={lighting.sunDir}
              sunColor={lighting.sunColor}
              skyHorizonColor={lighting.horizonColor}
              rainFactor={rainFactor}
              selectedId={selectedHotspot?.id ?? null}
              focusedId={focusedHotspotId}
              showAll={showAll}
              isTouchDevice={isTouchDevice}
              reducedMotion={reducedMotion}
              onSelect={handleSelectHotspotById}
            />

            <Trees
              treeSeasons={treeSeasons}
              selectedId={selectedHotspot?.id ?? null}
              focusedId={focusedHotspotId}
              showAll={showAll}
              isTouchDevice={isTouchDevice}
              reducedMotion={reducedMotion}
              onSelect={handleSelectHotspotById}
            />

            <NatureAndAnimals
              drynessFactor={drynessFactor}
              nightAmount={lighting.nightAmount}
              lowQuality={lowQuality || isSoftwareGl}
              selectedId={selectedHotspot?.id ?? null}
              focusedId={focusedHotspotId}
              showAll={showAll}
              isTouchDevice={isTouchDevice}
              reducedMotion={reducedMotion}
              onSelect={handleSelectHotspotById}
            />

            <WeatherFX rainFactor={rainFactor} reducedMotion={reducedMotion} />

            <CameraRig
              selectedId={selectedHotspot?.id ?? null}
              reducedMotion={reducedMotion}
            />

            {!isSoftwareGl && !lowQuality && (
              <EffectComposer multisampling={0}>
                <Bloom
                  intensity={0.26}
                  luminanceThreshold={0.92}
                  luminanceSmoothing={0.3}
                  mipmapBlur
                />
                <Vignette eskil={false} offset={0.22} darkness={0.32} />
              </EffectComposer>
            )}
          </Canvas>
        </div>
      ) : (
        <FarmFallbackSVG
          hotspots={HOTSPOTS}
          selectedHotspotId={selectedHotspot?.id ?? null}
          showAll={showAll}
          onSelect={(h) => setSelectedHotspot(h)}
        />
      )}

      {/* Growing Sprout Loading Overlay */}
      {webglOk && !sceneReady && (
        <div
          aria-live="polite"
          className="absolute inset-0 z-30 bg-[#F3F8EE] dark:bg-[#0F1A12] flex flex-col items-center justify-center gap-3 transition-opacity duration-500"
        >
          <div className="w-16 h-16 rounded-full bg-[#E6F2DC] dark:bg-[#1E3023] border border-[#CFE3C0] dark:border-[#2C4433] flex items-center justify-center shadow-lg animate-bounce">
            <Sprout className="w-8 h-8 text-[#2E9E4F]" />
          </div>
          <p className="text-sm font-display font-semibold text-[#1F2E1A] dark:text-[#E4F1E0]">
            Growing your 3D farm valley...
          </p>
        </div>
      )}

      {/* Top-Left Frosted Glass Farm Search HUD */}
      <div className="relative z-20 max-w-[1440px] mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pointer-events-none">
        <div
          className={`pointer-events-auto w-full max-w-[395px] rounded-[20px] border border-[#CFE3C0]/85 bg-[#FFFFFF]/90 dark:bg-[#16241A]/92 dark:border-[#2C4433] p-4 sm:p-5 shadow-2xl space-y-3 ${
            isSoftwareGl ? '' : 'backdrop-blur-md'
          }`}
        >
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-[var(--text-primary)] text-balance">
              Grow smarter with NASA Earth data
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              Click or tap any crop, tree, cow, pond, wildflower, or solar roof in the 3D valley—or enter your location for a live Grow Score.
            </p>
          </div>

          <form onSubmit={handleCheckField} className="space-y-2.5 relative">
            <div className="relative">
              <Search
                className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                placeholder="Search your farm, town, or region..."
                aria-label="Search field location"
                className="w-full min-h-[44px] pl-10 pr-10 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
              />
              {searching && (
                <Loader2 className="w-4 h-4 text-[var(--accent)] animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
              )}
            </div>

            {suggestions.length > 0 && (
              <ul
                role="listbox"
                className="absolute left-0 right-0 top-12 z-30 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl max-h-52 overflow-y-auto divide-y divide-[var(--border)]"
              >
                {suggestions.map((s, idx) => (
                  <li key={`${s.lat}-${s.lon}-${idx}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlace(s);
                        setSearchQuery(s.name);
                        setSuggestions([]);
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] cursor-pointer"
                    >
                      <div className="font-medium">{s.name}</div>
                      <div className="text-[11px] text-[var(--text-secondary)] truncate">
                        {s.displayName}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={locatingMe}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 min-h-[42px] rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors cursor-pointer"
              >
                {locatingMe ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />
                ) : (
                  <Compass className="w-3.5 h-3.5 text-[var(--teal)]" />
                )}
                <span>Use my location</span>
              </button>

              <button
                type="submit"
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 min-h-[42px] rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-95 transition-opacity cursor-pointer"
              >
                <span>Check my field</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </form>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border)] text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-[var(--teal)] truncate">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate font-mono">{selectedPlace.name}</span>
            </span>
            <span className="font-mono text-[var(--text-secondary)] shrink-0">
              {HOTSPOTS.length} interactive items
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar: Show all plants, Plant Guide, Time-of-Day, Live Weather, Floating Toggle */}
      <div className="absolute bottom-4 left-4 right-4 z-20 max-w-[1440px] mx-auto flex flex-wrap items-end justify-between gap-2.5 pointer-events-none">
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={triggerShowAllPlants}
            className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-xl border border-[#CFE3C0] bg-[#FFFFFF]/92 dark:bg-[#16241A]/92 dark:border-[#2C4433] text-xs font-semibold text-[var(--text-primary)] shadow-lg hover:border-[var(--accent)] cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>{showAll ? 'Showing all plants...' : 'Show all plants'}</span>
          </button>

          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-xl border border-[#CFE3C0] bg-[#FFFFFF]/92 dark:bg-[#16241A]/92 dark:border-[#2C4433] text-xs font-semibold text-[var(--text-primary)] shadow-lg hover:border-[var(--accent)] cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-[var(--earth)]" />
            <span>Plant Guide</span>
          </button>

          {/* Time of Day Slider */}
          <div className="inline-flex items-center gap-2 px-3 min-h-[42px] rounded-xl border border-[#CFE3C0] bg-[#FFFFFF]/92 dark:bg-[#16241A]/92 dark:border-[#2C4433] text-xs shadow-lg">
            <Sun className="w-3.5 h-3.5 text-[#F4B942] shrink-0" aria-hidden="true" />
            <label htmlFor="farm-time-slider" className="sr-only">
              Time of day lighting
            </label>
            <input
              id="farm-time-slider"
              type="range"
              min={0}
              max={23.75}
              step={0.25}
              value={timeHour}
              onChange={(e) => setTimeHour(Number(e.target.value))}
              className="w-20 sm:w-24 accent-[#2E9E4F] cursor-pointer"
            />
            <span className="font-mono text-[11px] text-[var(--text-primary)] w-11 text-right tabular-nums">
              {formatClockHour(timeHour)}
            </span>
          </div>

          {/* Live NASA Weather Toggle */}
          <button
            type="button"
            onClick={() => setWeatherEnabled((v) => !v)}
            aria-pressed={weatherEnabled}
            className={`inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-xl border text-xs font-semibold shadow-lg transition-colors cursor-pointer ${
              weatherEnabled
                ? 'bg-[#1F8A8A] border-[#1F8A8A] text-white'
                : 'border-[#CFE3C0] bg-[#FFFFFF]/92 dark:bg-[#16241A]/92 dark:border-[#2C4433] text-[var(--text-primary)] hover:border-[var(--accent)]'
            }`}
          >
            {weatherLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CloudRain className="w-3.5 h-3.5" />
            )}
            <span>
              {weatherEnabled && weatherSummary
                ? `NASA Weather: ${weatherSummary}`
                : 'Live NASA Weather'}
            </span>
          </button>

          {selectedHotspot && (
            <button
              type="button"
              onClick={() => setSelectedHotspot(null)}
              className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-xl bg-[#1F2E1A]/92 text-white text-xs font-semibold shadow-lg hover:opacity-95 cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
              <span>Whole farm</span>
            </button>
          )}
        </div>

        {/* Floating Hero Plant Mode Pill Toggle */}
        <div className="pointer-events-auto">
          <PlantModeToggle variant="hero" />
        </div>
      </div>

      {/* Plant Guide Directory Drawer */}
      <PlantGuideDrawer
        open={guideOpen}
        hotspots={HOTSPOTS}
        cropsById={cropsById}
        onSelectHotspot={(h) => setSelectedHotspot(h)}
        onClose={() => setGuideOpen(false)}
      />

      {/* Slide-in Plant Profile Panel (420px desktop, bottom sheet mobile) */}
      {selectedHotspot && activeCrop && (
        <PlantProfilePanel
          crop={activeCrop}
          location={selectedPlace}
          activeStage={cropStages[activeCrop.id] ?? 'vegetative'}
          onChangeStage={(cropId, stage) =>
            setCropStages((prev) => ({ ...prev, [cropId]: stage }))
          }
          treeSeason={treeSeasons[activeCrop.id] ?? 'summer'}
          onChangeTreeSeason={(cropId, season) =>
            setTreeSeasons((prev) => ({ ...prev, [cropId]: season }))
          }
          onClose={() => setSelectedHotspot(null)}
        />
      )}
    </section>
  );
};
