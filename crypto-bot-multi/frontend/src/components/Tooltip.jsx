import { useState, useRef } from 'react';

export default function Tooltip({ text, children }) {
  const [show, setShow]       = useState(false);
  const [openUp, setOpenUp]   = useState(false);
  const ref                   = useRef(null);

  function handleEnter() {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      // If less than 120px above the element, open downward
      setOpenUp(rect.top > 120);
    }
    setShow(true);
  }

  return (
    <span className="relative inline-flex items-center" ref={ref}>
      <span onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}>
        {children}
      </span>
      {show && (
        <span
          className={[
            'absolute z-50 w-56 text-xs text-gray-200 bg-gray-900 border border-brand-border',
            'rounded px-2.5 py-2 shadow-lg pointer-events-none whitespace-normal leading-relaxed',
            'left-1/2 -translate-x-1/2',
            openUp ? 'bottom-full mb-2' : 'top-full mt-2',
          ].join(' ')}
        >
          {text}
          {/* Arrow */}
          <span className={[
            'absolute left-1/2 -translate-x-1/2 border-4 border-transparent',
            openUp
              ? 'top-full border-t-gray-900'
              : 'bottom-full border-b-gray-900',
          ].join(' ')} />
        </span>
      )}
    </span>
  );
}

/** Small ? icon that shows a tooltip on hover */
export function InfoIcon({ text }) {
  return (
    <Tooltip text={text}>
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-brand-border text-gray-400 text-[9px] font-bold cursor-help select-none hover:bg-brand-blue/30 hover:text-brand-blue transition-colors">
        ?
      </span>
    </Tooltip>
  );
}
