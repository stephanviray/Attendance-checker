-- SQL script to create RPC function
CREATE OR REPLACE FUNCTION update_attendance_checkout(record_id BIGINT, checkout_time TIMESTAMPTZ)
