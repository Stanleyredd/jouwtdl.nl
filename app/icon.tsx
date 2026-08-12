import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1A1A1A",
        }}
      >
          <svg
            width="84%"
            height="84%"
            viewBox="0 0 1024 1024"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M 749.46 312.67 A 310 310 0 1 0 749.46 711.33"
              stroke="rgba(255,255,255,0.88)"
              strokeWidth="22"
              strokeLinecap="round"
            />
            <circle
              cx="512"
              cy="512"
              r="75"
              stroke="rgba(255,255,255,0.88)"
              strokeWidth="8"
            />
            <circle cx="512" cy="512" r="28" fill="rgba(255,255,255,0.88)" />
          </svg>
      </div>
    ),
    size,
  );
}
