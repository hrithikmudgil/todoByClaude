using Dapper;
using Npgsql;
using TodoApi.Domain;

namespace TodoApi.Data;

public enum TodoStatus
{
    All,
    Active,
    Completed,
}

/// <summary>
/// Every method takes the owning <c>userId</c> and puts it in the WHERE clause, so a query can never
/// touch another user's rows. A todo that exists but belongs to someone else is indistinguishable from
/// one that doesn't exist (callers return 404). All SQL is parameterized.
/// </summary>
public sealed class TodoRepository(NpgsqlDataSource dataSource)
{
    private const string Columns =
        "id, user_id, title, notes, is_completed, completed_at, created_at, updated_at";

    public async Task<IReadOnlyList<TodoItem>> ListAsync(Guid userId, TodoStatus status, CancellationToken ct)
    {
        // Fixed fragments chosen by switch; user input is never concatenated into SQL.
        var statusFilter = status switch
        {
            TodoStatus.Active => "and is_completed = false",
            TodoStatus.Completed => "and is_completed = true",
            _ => "",
        };

        await using var conn = await dataSource.OpenConnectionAsync(ct);
        var rows = await conn.QueryAsync<TodoItem>(new CommandDefinition(
            $"select {Columns} from todos where user_id = @userId {statusFilter} order by created_at desc, id desc",
            new { userId }, cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<TodoItem?> GetAsync(Guid userId, Guid id, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        return await conn.QuerySingleOrDefaultAsync<TodoItem>(new CommandDefinition(
            $"select {Columns} from todos where id = @id and user_id = @userId",
            new { id, userId }, cancellationToken: ct));
    }

    public async Task<TodoItem> CreateAsync(Guid userId, string title, string? notes, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        return await conn.QuerySingleAsync<TodoItem>(new CommandDefinition(
            $"""
            insert into todos (id, user_id, title, notes)
            values (@id, @userId, @title, @notes)
            returning {Columns}
            """,
            new { id = Guid.CreateVersion7(), userId, title, notes }, cancellationToken: ct));
    }

    public async Task<TodoItem?> UpdateAsync(Guid userId, Guid id, string title, string? notes, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        return await conn.QuerySingleOrDefaultAsync<TodoItem>(new CommandDefinition(
            $"""
            update todos set title = @title, notes = @notes, updated_at = now()
            where id = @id and user_id = @userId
            returning {Columns}
            """,
            new { id, userId, title, notes }, cancellationToken: ct));
    }

    /// <summary>Sets completion; completed_at is stamped on completion, kept if already completed, cleared otherwise.</summary>
    public async Task<TodoItem?> SetCompletedAsync(Guid userId, Guid id, bool isCompleted, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        return await conn.QuerySingleOrDefaultAsync<TodoItem>(new CommandDefinition(
            $"""
            update todos set
              is_completed = @isCompleted,
              completed_at = case when @isCompleted then coalesce(completed_at, now()) else null end,
              updated_at = now()
            where id = @id and user_id = @userId
            returning {Columns}
            """,
            new { id, userId, isCompleted }, cancellationToken: ct));
    }

    public async Task<bool> DeleteAsync(Guid userId, Guid id, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        var affected = await conn.ExecuteAsync(new CommandDefinition(
            "delete from todos where id = @id and user_id = @userId",
            new { id, userId }, cancellationToken: ct));
        return affected > 0;
    }

    public async Task<int> DeleteCompletedAsync(Guid userId, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        return await conn.ExecuteAsync(new CommandDefinition(
            "delete from todos where user_id = @userId and is_completed = true",
            new { userId }, cancellationToken: ct));
    }
}
