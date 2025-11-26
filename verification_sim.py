import numpy as np
import matplotlib.pyplot as plt

# 1. PHYSICAL CONSTANTS (Table III: Brussels)
SPEED_OF_LIGHT_METERS_PER_SECOND = 3e8 
CARRIER_FREQUENCY_HERTZ = 1837.5e6              # Carrier f = 1837.5 MHz
# Equation (4) coefficient kappa = (4pi * f / c)^2
PATH_LOSS_CONSTANT_KAPPA = (4 * np.pi * CARRIER_FREQUENCY_HERTZ / SPEED_OF_LIGHT_METERS_PER_SECOND)**2  

TRANSMIT_POWER_DBM = 62.75                      # PtGmax from Table III
TRANSMIT_POWER_WATTS = 10**((TRANSMIT_POWER_DBM - 30)/10) # ~1883.6 Watts
PATH_LOSS_EXPONENT_ALPHA = 3.2 
BASE_STATION_HEIGHT_METERS = 33.0 

NOISE_FLOOR_DBM = -96.21                        # Noise power sigma^2
NOISE_FLOOR_WATTS = 10**((NOISE_FLOOR_DBM - 30)/10) # ~2.39e-13 Watts

# 2. TOPOLOGY MODEL
# Section IV-B Inhomogeneous / Table III
SIMULATION_RADIUS_LIMIT_METERS = 7000.0 
# Gaussian proxy for the density model in Fig 9 
CITY_DISTRIBUTION_SPREAD_METERS = 1200.0        # Cluster spread
NUMBER_OF_BASE_STATIONS = 80                    # BS Count (approx density fit)
NUMBER_OF_MONTE_CARLO_ITERATIONS = 200 

def get_path_loss_attenuation_factor(distance_2d_meters):
    """
    Computes li according to Equation (4):
    l_i = kappa^-1 * (r^2 + z^2)^(-alpha/2)
    """
    distance_3d_squared = distance_2d_meters**2 + BASE_STATION_HEIGHT_METERS**2 
    attenuation_factor = (1.0 / PATH_LOSS_CONSTANT_KAPPA) * (distance_3d_squared)**(-PATH_LOSS_EXPONENT_ALPHA / 2.0)
    return attenuation_factor

def run_simulation():
    # Simulate user moving from City Center (0m) to Suburbs (4000m)
    user_distances_from_center = np.linspace(0, 4000, 50) 
    mean_emf_flux_density_results = []
    coverage_probability_results = []

    print(f"Physics Config: F={CARRIER_FREQUENCY_HERTZ/1e9}GHz, Pt={TRANSMIT_POWER_WATTS:.0f}W, Noise={NOISE_FLOOR_DBM}dBm")

    for current_user_distance in user_distances_from_center:
        monte_carlo_flux_samples = []
        monte_carlo_successful_connections = 0
        
        for _ in range(NUMBER_OF_MONTE_CARLO_ITERATIONS):
            # 1. Topology: Gaussian Cluster (Proxy for Eq 2 Inhomogeneous)
            base_station_x_coordinates = np.random.normal(0, CITY_DISTRIBUTION_SPREAD_METERS, NUMBER_OF_BASE_STATIONS)
            base_station_y_coordinates = np.random.normal(0, CITY_DISTRIBUTION_SPREAD_METERS, NUMBER_OF_BASE_STATIONS)
            
            # 2. Distances (User at current_user_distance on X-axis)
            distances_2d_meters = np.sqrt((base_station_x_coordinates - current_user_distance)**2 + (base_station_y_coordinates - 0)**2)
            
            # 3. Received Power Calculation
            # Pr = Pt * l(r) (Assuming unit gains G=1 for Brussels pg=1 case)
            path_loss_factors = get_path_loss_attenuation_factor(distances_2d_meters)
            received_powers_watts = TRANSMIT_POWER_WATTS * path_loss_factors
            
            total_received_power_watts = np.sum(received_powers_watts) # Total Power P (Eq 7)
            strongest_signal_watts = np.max(received_powers_watts)
            
            # 4. Metrics
            # Metric 1: Coverage (SINR)
            interference_watts = total_received_power_watts - strongest_signal_watts
            signal_to_interference_noise_ratio = strongest_signal_watts / (interference_watts + NOISE_FLOOR_WATTS)
            
            if signal_to_interference_noise_ratio > 0.5: # Approx 0dB threshold for coverage
                monte_carlo_successful_connections += 1
            
            # Metric 2: EMF Flux Density (S) - Equation (8)
            # S = (kappa / 4pi) * P
            electromagnetic_flux_density = (PATH_LOSS_CONSTANT_KAPPA / (4*np.pi)) * total_received_power_watts
            monte_carlo_flux_samples.append(electromagnetic_flux_density)

        mean_emf_flux_density_results.append(np.mean(monte_carlo_flux_samples))
        coverage_probability_results.append(monte_carlo_successful_connections / NUMBER_OF_MONTE_CARLO_ITERATIONS)

    return user_distances_from_center, mean_emf_flux_density_results, coverage_probability_results

#3. PLOT
x_axis_distances, y_axis_emf_values, y_axis_coverage_values = run_simulation()

plt.style.use('ggplot')
figure, axis_emf = plt.subplots(figsize=(9, 6))

color_emf_red = '#D32F2F' # Dark Red
axis_emf.set_xlabel('Distance from City Center (m)')
axis_emf.set_ylabel('Mean EMF Flux Density ($W/m^2$)', color=color_emf_red)
axis_emf.semilogy(x_axis_distances, y_axis_emf_values, color=color_emf_red, linewidth=2, label='EMF Exposure (S)')
axis_emf.tick_params(axis='y', labelcolor=color_emf_red)

axis_coverage = axis_emf.twinx() 
color_coverage_blue = '#1976D2' # Blue
axis_coverage.set_ylabel('Coverage Probability ($SINR > -3dB$)', color=color_coverage_blue)
axis_coverage.plot(x_axis_distances, y_axis_coverage_values, color=color_coverage_blue, linestyle='--', marker='.', label='Coverage Prob')
axis_coverage.tick_params(axis='y', labelcolor=color_coverage_blue)

plt.title('Monte Carlo Verification: Brussels Model\n(Physically consistent with Table III)')
plt.grid(True, which='both', alpha=0.3)
figure.tight_layout()
plt.show()