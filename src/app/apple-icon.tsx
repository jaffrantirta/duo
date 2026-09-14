import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background: "#FBF8F3",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 34,
            top: 51,
            width: 77,
            height: 77,
            borderRadius: "50%",
            background: "#FFD8C2",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 69,
            top: 51,
            width: 77,
            height: 77,
            borderRadius: "50%",
            background: "#E3DAFF",
            opacity: 0.85,
          }}
        />
      </div>
    ),
    size,
  );
}
