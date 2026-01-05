 1. User session should be store in the redis.
 WHen role/status change then remove those sessions from redis so that user can't access the application.

2. logout-all and admin sesssions revoke api should be tested after redis (above point)

3. 2FA backup code consume api pending. Make sure to have code. For now, contact support team.

4. redpanda panda port 19092 into the 9092 b/c of antigravity

5. Client id and secret for google is from client. Take it and replace it for OAUTH