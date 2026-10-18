// Material Symbols 風の簡単なアイコン（装飾なので aria-hidden）

type P = { className?: string };

function Svg({ className, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      className={className ?? "size-5"}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: P) => (
  <Svg {...p}>
    <path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 9.5 16a6.5 6.5 0 0 0 4.2-1.6l.3.3v.8l5 5 1.5-1.5-5-5Zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9Z" />
  </Svg>
);
export const CloseIcon = (p: P) => (
  <Svg {...p}>
    <path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4Z" />
  </Svg>
);
export const BackIcon = (p: P) => (
  <Svg {...p}>
    <path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20v-2Z" />
  </Svg>
);
export const PlusIcon = (p: P) => (
  <Svg {...p}>
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2Z" />
  </Svg>
);
export const MinusIcon = (p: P) => (
  <Svg {...p}>
    <path d="M19 13H5v-2h14v2Z" />
  </Svg>
);
export const WorldIcon = (p: P) => (
  <Svg {...p}>
    <path d="m20.5 3-.2.1L15 5.1 9 3 3.4 4.9c-.2.1-.4.3-.4.5v15.1c0 .3.2.5.5.5h.2L9 18.9l6 2.1 5.6-1.9c.2-.1.4-.3.4-.5V3.5c0-.3-.2-.5-.5-.5ZM15 19l-6-2.1V5l6 2.1V19Z" />
  </Svg>
);
export const CityIcon = (p: P) => (
  <Svg {...p}>
    <path d="M15 11V5l-3-3-3 3v2H3v14h18V11h-6Zm-8 8H5v-2h2v2Zm0-4H5v-2h2v2Zm0-4H5V9h2v2Zm6 8h-2v-2h2v2Zm0-4h-2v-2h2v2Zm0-4h-2V9h2v2Zm0-4h-2V5h2v2Zm6 12h-2v-2h2v2Zm0-4h-2v-2h2v2Z" />
  </Svg>
);
export const PinIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
  </Svg>
);
export const MyLocationIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8.9 3A9 9 0 0 0 13 3.1V1h-2v2.1A9 9 0 0 0 3.1 11H1v2h2.1a9 9 0 0 0 7.9 7.9V23h2v-2.1a9 9 0 0 0 7.9-7.9H23v-2h-2.1ZM12 19a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z" />
  </Svg>
);
export const TuneIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3 17v2h6v-2H3ZM3 5v2h10V5H3Zm10 16v-2h8v-2h-8v-2h-2v6h2ZM7 9v2H3v2h4v2h2V9H7Zm14 4v-2H11v2h10Zm-6-4h2V7h4V5h-4V3h-2v6Z" />
  </Svg>
);
export const MapIcon = (p: P) => (
  <Svg {...p}>
    <path d="m15 5.1-6-2.1-6 2.3v16.2l6-2.3 6 2.1 6-2.3V2.8l-6 2.3Zm-.9 13.6-4.2-1.5V5.3l4.2 1.5v11.9ZM5 6.6l3-1.1v11.9l-3 1.2v-12Zm11 10.8V5.5l3-1.2v12l-3 1.1Z" />
  </Svg>
);
export const ListIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3 13h2v-2H3v2Zm0 4h2v-2H3v2Zm0-8h2V7H3v2Zm4 4h14v-2H7v2Zm0 4h14v-2H7v2ZM7 7v2h14V7H7Z" />
  </Svg>
);
export const WarnIcon = (p: P) => (
  <Svg {...p}>
    <path d="M1 21h22L12 2 1 21Zm12-3h-2v-2h2v2Zm0-4h-2v-4h2v4Z" />
  </Svg>
);
export const CheckIcon = (p: P) => (
  <Svg {...p}>
    <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" />
  </Svg>
);
export const PersonIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="6.5" r="3.5" />
    <path d="M12 12c-3.9 0-7 2.2-7 5v3h14v-3c0-2.8-3.1-5-7-5Z" />
  </Svg>
);
export const PeopleIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="8.5" cy="7" r="3" />
    <circle cx="16" cy="7.5" r="2.6" />
    <path d="M8.5 12C5.4 12 3 13.8 3 16v3h11v-3c0-2.2-2.4-4-5.5-4Zm7.5.4c-.7 0-1.3.1-1.9.3 1.1.9 1.9 2 1.9 3.3v3h5v-3c0-2-2.2-3.6-5-3.6Z" />
  </Svg>
);
export const InfoIcon = (p: P) => (
  <Svg {...p}>
    <path d="M11 7h2v2h-2V7Zm0 4h2v6h-2v-6Zm1-9a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />
  </Svg>
);
