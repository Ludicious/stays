-- Fix 6: Correct Good Sam annual fee from $39 to $30
-- Source: Session 4.5 bug-fix pass
UPDATE memberships
SET    annual_fee = 30.00
WHERE  name = 'Good Sam';

-- Verify:
-- SELECT name, annual_fee FROM memberships ORDER BY name;
