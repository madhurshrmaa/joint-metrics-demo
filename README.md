# Joint Metrics for EMF Exposure and Coverage
## Interactive Brussels Model Demonstration

**Live Demo:** [Click Here to View Visualization](https://madhurshrmaa.github.io/joint-metrics-demo/)

### Overview
This project visualizes the "Motion-Variant" Brussels Inhomogeneous model described in **Section IV-B (Table III)** of *Gontier & Wiame (2024)*. It allows for an intuitive exploration of the trade-off between coverage quality (SINR) and cumulative EMF flux density ($W/m^2$).

### Components
1. **Interactive Visualization (`sketch.js`):** A browser-based dashboard rendered using p5.js. It visualizes:
   - Inhomogeneous topology (Gaussian clustering to mimic City Center vs. Suburbs).
   - Real-time conversion of Receive Power ($P_r$) to Flux Density ($S$) derived from Table III parameters.
   
2. **Numerical Verification (`verification_sim.py`):** A Python script performing Monte Carlo simulations (N=200) to validate the statistical trends of the visualization against the analytical results in the paper.
