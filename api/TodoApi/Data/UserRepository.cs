using Dapper;
using Npgsql;
using TodoApi.Domain;

namespace TodoApi.Data;

public sealed class UserRepository(NpgsqlDataSource dataSource)
{
    private const string Columns =
        "id, email, normalized_email, password_hash, failed_login_count, locked_until, created_at";

    public async Task<User?> FindByNormalizedEmailAsync(string normalizedEmail, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        return await conn.QuerySingleOrDefaultAsync<User>(new CommandDefinition(
            $"select {Columns} from users where normalized_email = @normalizedEmail",
            new { normalizedEmail }, cancellationToken: ct));
    }

    public async Task<User?> FindByIdAsync(Guid id, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        return await conn.QuerySingleOrDefaultAsync<User>(new CommandDefinition(
            $"select {Columns} from users where id = @id",
            new { id }, cancellationToken: ct));
    }

    /// <summary>Inserts the user. Returns false (instead of throwing) if the email is already registered.</summary>
    public async Task<bool> TryCreateAsync(User user, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        try
        {
            await conn.ExecuteAsync(new CommandDefinition(
                """
                insert into users (id, email, normalized_email, password_hash, created_at)
                values (@Id, @Email, @NormalizedEmail, @PasswordHash, @CreatedAt)
                """,
                user, cancellationToken: ct));
            return true;
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            return false;
        }
    }

    /// <summary>
    /// Atomically bumps the failure counter; on reaching <paramref name="maxAttempts"/> it locks the
    /// account for <paramref name="lockout"/> and resets the counter.
    /// </summary>
    public async Task RecordFailedLoginAsync(Guid id, int maxAttempts, TimeSpan lockout, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await conn.ExecuteAsync(new CommandDefinition(
            """
            update users set
              locked_until = case when failed_login_count + 1 >= @maxAttempts
                                  then now() + @lockout else locked_until end,
              failed_login_count = case when failed_login_count + 1 >= @maxAttempts
                                        then 0 else failed_login_count + 1 end
            where id = @id
            """,
            new { id, maxAttempts, lockout }, cancellationToken: ct));
    }

    public async Task RecordSuccessfulLoginAsync(Guid id, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await conn.ExecuteAsync(new CommandDefinition(
            "update users set failed_login_count = 0, locked_until = null where id = @id",
            new { id }, cancellationToken: ct));
    }

    public async Task UpdatePasswordHashAsync(Guid id, string passwordHash, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await conn.ExecuteAsync(new CommandDefinition(
            "update users set password_hash = @passwordHash where id = @id",
            new { id, passwordHash }, cancellationToken: ct));
    }
}
