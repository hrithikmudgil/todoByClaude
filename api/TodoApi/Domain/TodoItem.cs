namespace TodoApi.Domain;

/// <summary>A row of the <c>todos</c> table. Timestamps are UTC.</summary>
public sealed record TodoItem
{
    public Guid Id { get; init; }
    public Guid UserId { get; init; }
    public string Title { get; init; } = "";
    public string? Notes { get; init; }
    public bool IsCompleted { get; init; }
    public DateTime? CompletedAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}
