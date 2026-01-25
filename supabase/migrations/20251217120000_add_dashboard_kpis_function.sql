-- Création d'une fonction RPC pour récupérer les KPIs du tableau de bord
CREATE OR REPLACE FUNCTION get_dashboard_kpis()
RETURNS TABLE (
    total_revenue numeric,
    total_orders bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM((d.details_json->>'total')::numeric), 0) as total_revenue,
        COUNT(d.id)::bigint as total_orders
    FROM
        demandes d
    WHERE
        d.status NOT IN ('cancelled', 'pending_quote') AND
        d.created_at >= date_trunc('month', NOW());
END;
$$ LANGUAGE plpgsql;
