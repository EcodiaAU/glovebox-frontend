export default function AppLoading() {
  return (
    <div className="trip-wrap-center">
      <div
        className="glovebox-spin"
        style={{
          width: 28,
          height: 28,
          border: "3px solid var(--glovebox-border, #ddd)",
          borderTopColor: "var(--glovebox-accent, #42b159)",
          borderRadius: "50%",
          animation: "glovebox-spin 0.6s linear infinite",
        }}
      />
    </div>
  );
}
