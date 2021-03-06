CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE "public"."ExecutedTransitions"("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "time" timestamptz NOT NULL, "broadcastContentId" uuid NOT NULL, "fallbackBroadcastContentId" uuid NOT NULL, "eventId" uuid NOT NULL, "roomId" uuid NOT NULL, PRIMARY KEY ("id") , FOREIGN KEY ("broadcastContentId") REFERENCES "public"."BroadcastContentItem"("id") ON UPDATE cascade ON DELETE restrict, FOREIGN KEY ("fallbackBroadcastContentId") REFERENCES "public"."BroadcastContentItem"("id") ON UPDATE cascade ON DELETE restrict, FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON UPDATE cascade ON DELETE restrict, FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON UPDATE cascade ON DELETE restrict);
CREATE OR REPLACE FUNCTION "public"."set_current_timestamp_updated_at"()
RETURNS TRIGGER AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updated_at" = NOW();
  RETURN _new;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "set_public_ExecutedTransitions_updated_at"
BEFORE UPDATE ON "public"."ExecutedTransitions"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updated_at"();
COMMENT ON TRIGGER "set_public_ExecutedTransitions_updated_at" ON "public"."ExecutedTransitions" 
IS 'trigger to set value of column "updated_at" to current timestamp on row update';
