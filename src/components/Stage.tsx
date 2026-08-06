import { useEffect, useState, type ReactNode } from "react";

/**
 * FarAction landscape stage.
 *
 * The whole game is composed on a fixed 1440x823 landscape canvas — the same
 * technique the reference arena game uses. The canvas is scaled to fit the
 * viewport, and on portrait phones it is rotated 90deg so the world always
 * reads as a wide arena instead of a stack of cards.
 */
export const DESIGN_W = 1440;
export const DESIGN_H = 823;

/**
 * The transform is published through a dedicated <style> element rather than an
 * inline style on <html>, so the pre-paint script never mutates SSR markup that
 * React later hydrates.
 */
const STYLE_ID = "fa-stage-style";

export const STAGE_PREPAINT = `(function(){try{
var w=window.innerWidth,h=window.innerHeight,dw=${DESIGN_W},dh=${DESIGN_H},s,tx,ty,tr;
if(h>w){s=Math.min(w/dh,h/dw);tx=w/2+(dh*s)/2;ty=h/2-(dw*s)/2;tr='translate('+tx+'px,'+ty+'px) rotate(90deg) scale('+s+')';}
else{s=Math.min(w/dw,h/dh);tx=(w-dw*s)/2;ty=(h-dh*s)/2;tr='translate('+tx+'px,'+ty+'px) scale('+s+')';}
var el=document.createElement('style');el.id='${STYLE_ID}';
el.textContent=':root{--fa-tr:'+tr+';--fa-rotated:'+(h>w?'1':'0')+';}';
document.head.appendChild(el);
}catch(e){}})();`;

function computeTransform() {
  const viewport = window.visualViewport;
  const vw = viewport?.width ?? window.innerWidth;
  const vh = viewport?.height ?? window.innerHeight;
  const rotated = vh > vw;
  let transform: string;
  if (rotated) {
    const s = Math.min(vw / DESIGN_H, vh / DESIGN_W);
    transform = `translate(${vw / 2 + (DESIGN_H * s) / 2}px, ${vh / 2 - (DESIGN_W * s) / 2}px) rotate(90deg) scale(${s})`;
  } else {
    const s = Math.min(vw / DESIGN_W, vh / DESIGN_H);
    transform = `translate(${(vw - DESIGN_W * s) / 2}px, ${(vh - DESIGN_H * s) / 2}px) scale(${s})`;
  }
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = `:root{--fa-tr:${transform};--fa-rotated:${rotated ? 1 : 0};}`;
  return rotated;
}

export function Stage({ children }: { children: ReactNode }) {
  const [rotated, setRotated] = useState(false);

  useEffect(() => {
    const sync = () => setRotated(computeTransform());
    sync();
    const viewport = window.visualViewport;
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    viewport?.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      viewport?.removeEventListener("resize", sync);
    };
  }, []);

  return (
    <div className="fa-viewport">
      <div className="fa-stage">{children}</div>
      {rotated ? <RotateHint /> : null}
    </div>
  );
}

const HINT_KEY = "faraction:rotate-hint";

function RotateHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(HINT_KEY) !== "1") setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={() => {
        try {
          window.sessionStorage.setItem(HINT_KEY, "1");
        } catch {
          /* ignore */
        }
        setShow(false);
      }}
      className="fa-rotate-hint"
    >
      <span className="fa-rotate-phone" aria-hidden>
        <svg
          width="30"
          height="30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <rect x="5" y="2" width="14" height="20" rx="2.5" />
          <line x1="12" y1="18" x2="12.01" y2="18" strokeLinecap="round" />
        </svg>
      </span>
      <span className="label-xs">Rotate your device</span>
      <span className="text-[11px] text-muted-foreground">
        FarAction plays in landscape · tap to dismiss
      </span>
    </button>
  );
}
