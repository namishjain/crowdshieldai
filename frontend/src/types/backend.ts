export type RiskState = "SAFE" | "WARNING" | "HIGH" | "CRITICAL" | "NO_DATA";

export type CameraState = {
  camera_id: string;
  zone_id: string;
  zone_name: string;
  status: string;
  video_time_seconds: number;
  count: number | null;
  maximum_count: number;
  average_count: number | null;
  count_trend_people_per_minute: number | null;
  density_score: number | null;
  flow_rate_per_minute: number | null;
  inbound_per_minute: number | null;
  outbound_per_minute: number | null;
  direction: string | null;
  average_speed_pixels_per_second: number | null;
  capacity: number;
  capacity_utilization_percent: number | null;
  risk_score: number | null;
  risk_state: RiskState | null;
  risk_components: Record<string, number>;
  processing_fps: number | null;
  inference_latency_ms: number | null;
  video_url: string | null;
  message: string | null;
};

export type Recommendation = {
  action_id: string;
  action_type: string;
  priority: string;
  target: string;
  reason: string;
  expected_effect: string;
  source_zone?: string | null;
  simulated: boolean;
};

export type RouteState = {
  route: string[];
  node_names: string[];
  destination: string | null;
  total_cost: number | null;
  distance_m: number | null;
  route_risk: number | null;
  congestion_percent: number | null;
  estimated_travel_seconds: number | null;
  estimated_evacuation_minutes: number | null;
  reason: string;
};

export type SimulationResult = {
  scenario_id: string;
  scenario_label: string;
  target: string;
  mode: string;
  baseline_source: string;
  synthetic_scenario_adjustment: boolean;
  before: {
    risk_score: number;
    risk_state: RiskState;
    route: RouteState;
    gate_states: Record<string, string>;
    people_in_simulation: number;
  };
  after: {
    risk_score: number;
    risk_state: RiskState;
    route: RouteState;
    gate_states: Record<string, string>;
    people_in_simulation: number;
    agents_evacuated_in_steps: number;
    steps: number;
    step_duration_seconds: number;
    estimated_remaining_evacuation_minutes: number;
    exposure_adjustment_points: number;
  };
  recommendations: Recommendation[];
  limitations: string;
};

export type EventState = {
  event_id: string;
  type: string;
  timestamp: string;
  previous_state?: string | null;
  new_state?: string | null;
  risk_score?: number | null;
  zone_id?: string | null;
  action: string;
  reason: string;
};

export type CrowdState = {
  timestamp: string;
  demo_time_seconds: number;
  venue: { id?: string; name?: string; topology_status?: string; measurement_basis?: string; views_with_measurements?: number; demo_video_time_seconds?: number };
  venue_state: RiskState;
  global_risk_score: number | null;
  global_risk_state: RiskState;
  global_risk_basis: string;
  risk_components: Record<string, number>;
  cameras: CameraState[];
  zones: Array<{ zone_id: string; name: string; node: string; camera_id: string; count: number | null; capacity: number; risk_score: number | null; risk_state: RiskState | null; trend: string; trend_people_per_minute: number | null }>;
  predictions: Array<{ horizon_minutes: number; projected_count: number | null; projected_risk_score: number | null; projected_risk_state: RiskState }>;
  prediction_method: string;
  route: RouteState;
  recommendations: Recommendation[];
  events: EventState[];
  gates: Record<string, string>;
  simulation: SimulationResult | null;
  system: { device?: string; model?: string; backend_status?: string; processing_mode?: string; prediction_method?: string; configured_cameras?: number; topology_status?: string; active_feed_id?: string; active_feed_label?: string; operator_id?: string; footage_notice?: string };
};
