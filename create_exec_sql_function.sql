-- Create a function to execute SQL statements from the client
CREATE OR REPLACE FUNCTION exec_sql(sql_string text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_string;
  RETURN 'SQL executed successfully';
EXCEPTION
  WHEN OTHERS THEN
    RETURN SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION exec_sql(text) TO authenticated;

-- Create a safer version that only allows CREATE TABLE IF NOT EXISTS
CREATE OR REPLACE FUNCTION create_table_if_not_exists(sql_string text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the SQL contains only allowed patterns
  IF sql_string ~* '^CREATE TABLE IF NOT EXISTS.*$' THEN
    EXECUTE sql_string;
    RETURN 'Table created successfully';
  ELSE
    RETURN 'SQL not allowed. Only CREATE TABLE IF NOT EXISTS is permitted.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RETURN SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_table_if_not_exists(text) TO authenticated; 