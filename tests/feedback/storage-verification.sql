-- Run with `supabase db query --linked --file tests/feedback/storage-verification.sql`.
-- Every test write is rolled back; no student response is changed.
begin;
do $$
declare
    form_id uuid;
    response_id uuid := gen_random_uuid();
    retry_key uuid := gen_random_uuid();
    old_version integer;
    test_questions jsonb;
    original_count integer;
begin
    select id, form_version, questions into form_id, old_version, test_questions
    from public.feedback_forms where slug='nift-bhubaneswar-space-materiality-2026-11-03';
    if form_id is null then raise exception 'NIFT form missing'; end if;
    insert into public.feedback_responses (id, form_id, submission_key, form_version, answers, question_snapshot)
    values (response_id, form_id, retry_key, old_version, '{"best_part":"Transactional verification"}', test_questions);
    begin
        insert into public.feedback_responses (form_id, submission_key, form_version, answers, question_snapshot)
        values (form_id, retry_key, old_version, '{"best_part":"Duplicate"}', test_questions);
        raise exception 'Duplicate submission was accepted';
    exception when unique_violation then null;
    end;
    update public.feedback_forms set questions=questions || '[{"id":"verification_only","label":"Temporary test question","type":"text"}]'::jsonb
    where id=form_id;
    if not exists (select 1 from public.feedback_forms where id=form_id and form_version=old_version+1) then
        raise exception 'Question version not incremented';
    end if;
    if not exists (select 1 from public.feedback_responses where id=response_id and question_snapshot=test_questions and form_version=old_version) then
        raise exception 'Historical questions changed';
    end if;
    if has_table_privilege('anon','public.feedback_responses','select')
        or has_table_privilege('authenticated','public.feedback_responses','select')
        or has_table_privilege('anon','public.feedback_responses','insert') then
        raise exception 'Response table is directly accessible';
    end if;
    select count(*) into original_count from public.du_workshop_feedback;
    if original_count <> (select count(*) from public.feedback_responses r join public.du_workshop_feedback d on d.id=r.id) then
        raise exception 'DU migration count mismatch';
    end if;
end;
$$;
rollback;
select 'Storage verification passed; all test writes rolled back.' as result;
