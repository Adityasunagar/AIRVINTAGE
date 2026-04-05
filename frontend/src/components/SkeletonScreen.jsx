import React from "react";

export default function SkeletonScreen() {
	return (
		<div className="app-content-wrapper">
			{/* Hero Section Skeleton */}
			<div className="premium-hero">
					<div className="hero-bg-layer" aria-hidden="true" />
					<div style={{ padding: "40px 20px", textAlign: "center" }}>
						<div className="skeleton-aqi-label" style={{ margin: "0 auto 12px", width: "150px" }} />
						<div className="skeleton-aqi-value" style={{ margin: "0 auto 16px", width: "120px", height: "64px" }} />
						<div className="skeleton-card-title" style={{ margin: "0 auto 12px", width: "200px" }} />
					</div>
				</div>

				{/* Cards Skeleton */}
				<main className="main-content premium-main">
					<div className="skeleton-dashboard">
						{[1, 2].map((i) => (
							<div key={i} className="skeleton-aqi-card">
								{/* Title */}
								<div className="skeleton-card-title" style={{ width: "80%", marginBottom: "16px" }} />

								{/* Main Value */}
								<div
									className="skeleton-aqi-value"
									style={{ width: "100px", height: "56px", marginBottom: "12px" }}
								/>

								{/* Label */}
								<div className="skeleton-aqi-label" style={{ marginBottom: "16px" }} />

								{/* Details Grid */}
								<div className="skeleton-details">
									<div className="skeleton-detail-item">
										<div className="skeleton-detail-label" />
										<div className="skeleton-detail-value" />
									</div>
									<div className="skeleton-detail-item">
										<div className="skeleton-detail-label" />
										<div className="skeleton-detail-value" />
									</div>
									<div className="skeleton-detail-item">
										<div className="skeleton-detail-label" />
										<div className="skeleton-detail-value" />
									</div>
									<div className="skeleton-detail-item">
										<div className="skeleton-detail-label" />
										<div className="skeleton-detail-value" />
									</div>
								</div>
							</div>
						))}
					</div>
				</main>

				<div style={{ textAlign: "center", padding: "20px", color: "var(--text-3)", fontSize: "0.9rem", paddingBottom: "40px" }}>
					💨 Loading real-time air quality data...
				</div>
			</div>
	);
}
