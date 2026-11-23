namespace TodoApi.Domain;

/// <summary>A row of the <c>users</c> table. Property names map to snake_case columns via Dapper.</summary>
public sealed record User
{
    public Guid Id { get; init; }
    public string Email { get; init; } = "";
    public string NormalizedEmail { get; init; } = "";
    public string PasswordHash { get; init; } = "";
    public int FailedLoginCount { get; init; }
    public DateTime? LockedUntil { get; init; }
    public DateTime CreatedAt { get; init; }
}
