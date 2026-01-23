-- Create increment_usage database function for atomic usage tracking
-- This function safely increments usage counts with conflict resolution

CREATE OR REPLACE FUNCTION increment_usage(
  p_organization_id UUID,
  p_metric_type TEXT,
  p_date DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Attempt to insert a new quota record or increment existing count
  INSERT INTO usage_quotas (
    organization_id,
    metric_type,
    date,
    count,
    limit_amount
  )
  VALUES (
    p_organization_id,
    p_metric_type,
    p_date,
    1,
    -- Get the limit from the active subscription's plan features
    (
      SELECT 
        CASE p_metric_type
          WHEN 'signals' THEN (bp.features->>'signals_per_day')::INT
          WHEN 'ai_prompts' THEN (bp.features->>'ai_prompts_per_day')::INT
          ELSE NULL
        END
      FROM subscriptions s
      JOIN billing_plans bp ON s.plan_id = bp.id
      WHERE s.organization_id = p_organization_id
        AND s.status = 'active'
      LIMIT 1
    )
  )
  ON CONFLICT (organization_id, metric_type, date)
  DO UPDATE SET
    count = usage_quotas.count + 1,
    updated_at = NOW();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_usage(UUID, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_usage(UUID, TEXT, DATE) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION increment_usage IS 'Atomically increments usage count for a given organization, metric type, and date. Creates quota record if it doesn''t exist.';
