using Dapper;
using Npgsql;

namespace TodoApi.Data;

public static class Db
{
    public const string ConnectionStringName = "Default";

    /// <summary>Registers a singleton <see cref="NpgsqlDataSource"/>, the repositories, and configures Dapper.</summary>
    public static IServiceCollection AddDatabase(this IServiceCollection services)
    {
        // users.password_hash -> User.PasswordHash, etc.
        DefaultTypeMap.MatchNamesWithUnderscores = true;

        // Resolved lazily from the final configuration, so test hosts can override the connection string.
        services.AddSingleton(sp =>
            NpgsqlDataSource.Create(sp.GetRequiredService<IConfiguration>().GetRequiredConnectionString()));

        services.AddSingleton<UserRepository>();
        services.AddSingleton<TodoRepository>();

        return services;
    }

    public static string GetRequiredConnectionString(this IConfiguration configuration) =>
        configuration.GetConnectionString(ConnectionStringName)
        ?? throw new InvalidOperationException(
            $"ConnectionStrings:{ConnectionStringName} is not configured. " +
            $"Set it with the ConnectionStrings__{ConnectionStringName} environment variable or user-secrets.");
}
