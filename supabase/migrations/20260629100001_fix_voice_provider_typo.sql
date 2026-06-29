-- Fix typo: openai-coral had provider='openid' instead of 'openai'
UPDATE ams_voices SET provider = 'openai' WHERE id = 'openai-coral' AND provider = 'openid';
